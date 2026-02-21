/**
 * Batch Download Service
 *
 * Downloads all course files in a single request using Moodle's
 * bulk download endpoint, then extracts, converts, and caches files.
 */

import { createLogger } from '@aryazos/ts-base/logging';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { extname, join } from "path";
import { remoteCache } from "../remoteCache";
import {
    convertToPdf,
    isConvertible,
    normalizeFilename
} from "../services/conversion";
import { state } from "./state";

const logger = createLogger("com.aryazos.moodle.batch-download");

/**
 * Extract contextId from course HTML page.
 * Looks for M.cfg.contextid in the JavaScript config.
 */
export function extractContextId(html: string): string | null {
  // Try M.cfg.contextid from JS config
  const cfgMatch = html.match(/"contextid"\s*:\s*(\d+)/);
  if (cfgMatch) {
    return cfgMatch[1];
  }

  // Fallback: try download link
  const linkMatch = html.match(/downloadcontent\.php\?contextid=(\d+)/);
  if (linkMatch) {
    return linkMatch[1];
  }

  return null;
}

/**
 * Parse fileId from Moodle ZIP folder name.
 * Format: File_SomeName_.{fileId}
 */
function parseFileIdFromFolderName(folderName: string): string | null {
  // Match pattern like "File_Serie_01_Aufgaben_.1172169"
  const match = folderName.match(/\.(\d+)$/);
  return match ? match[1] : null;
}

export interface BatchDownloadOptions {
  /** Convert Office files to PDF (default: true) */
  convertToPdf?: boolean;
  /** Include all file types, not just PDFs and convertible (default: false) */
  includeAll?: boolean;
}

export interface BatchDownloadStats {
  cached: number;
  converted: number;
  skipped: number;
  errors: number;
}

/**
 * Download course ZIP from Moodle and cache files.
 *
 * By default: caches PDFs directly, converts Office files to PDF
 * With includeAll: caches all file types
 * With convertToPdf: false: only caches existing PDFs
 */
export async function batchDownloadCourse(
  courseId: string,
  contextId: string,
  options: BatchDownloadOptions = {}
): Promise<BatchDownloadStats> {
  const { convertToPdf: doConvert = true, includeAll = false } = options;
  const stats: BatchDownloadStats = { cached: 0, converted: 0, skipped: 0, errors: 0 };

  if (!state.isAuthenticated || !state.fetcher) {
    throw new Error("Not authenticated with Moodle");
  }

  const sesskey = await state.fetcher.getSesskey();
  if (!sesskey) {
    throw new Error("Failed to get sesskey");
  }

  logger.info("Starting batch download", { courseId, contextId, doConvert, includeAll });

  // Create temp directory for extraction
  const tempDir = join(tmpdir(), `moodle-batch-${courseId}-${Date.now()}`);
  const zipPath = join(tempDir, "course.zip");

  try {
    mkdirSync(tempDir, { recursive: true });

    // Download ZIP
    const baseUrl = state.fetcher["baseUrl"];
    const cookies = state.fetcher["cookies"];

    const response = await fetch(`${baseUrl}/course/downloadcontent.php`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Cookie": cookies,
      },
      body: `contextid=${contextId}&download=1&sesskey=${sesskey}`,
      redirect: "follow",
    });

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }

    // Check content type
    const contentType = response.headers.get("content-type") || "";
    const validZipTypes = ["application/zip", "application/x-zip", "application/x-zip-compressed", "application/octet-stream"];
    if (!validZipTypes.some(t => contentType.includes(t))) {
      logger.warn("Unexpected content type", { contentType });
    }

    // Save ZIP to temp file
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length < 100) {
      throw new Error("ZIP file too small - likely an error page");
    }

    writeFileSync(zipPath, buffer);
    logger.info("Downloaded ZIP", { size: buffer.length, path: zipPath });

    // Extract ZIP using system unzip (robust against Moodle's data descriptors)
    const extractDir = join(tempDir, "extracted");
    mkdirSync(extractDir, { recursive: true });

    try {
      // Use adm-zip for extraction instead of system unzip to handle encoding better
      // and avoid issues with macOS unzip utility
      const AdmZip = require("adm-zip");
      const zip = new AdmZip(zipPath);
      zip.extractAllTo(extractDir, true);
      logger.info("Extracted ZIP using adm-zip");
    } catch (err) {
      logger.warn("ZIP extraction failed", { error: err });
    }

    // Recursively find all folders that look like Moodle file folders (File_*)
    const fileFolders: { path: string; name: string }[] = [];

    function scanForFileFolders(dir: string) {
      try {
        const items = readdirSync(dir, { withFileTypes: true });
        for (const item of items) {
          if (!item.isDirectory()) continue;

          // Normalize the folder name to handle encoding issues
          const normalizedName = normalizeFilename(item.name);

          // Check if this folder matches our file pattern (starts with File_)
          if (normalizedName.startsWith("File_") && parseFileIdFromFolderName(normalizedName)) {
            fileFolders.push({ path: join(dir, item.name), name: normalizedName });
          } else {
            // Recurse (e.g. course/section folder)
            scanForFileFolders(join(dir, item.name));
          }
        }
      } catch (e) {
        logger.debug("Error scanning directory", { dir, error: e });
      }
    }

    // Start scan from extractDir
    scanForFileFolders(extractDir);
    logger.info("Found file folders in ZIP", { count: fileFolders.length });

    for (const folder of fileFolders) {
      const fileId = parseFileIdFromFolderName(folder.name);
      if (!fileId) continue;

      // Look for files in content/ subfolder
      const contentDir = join(folder.path, "content");
      if (!existsSync(contentDir)) {
        logger.debug("No content folder", { name: folder.name });
        stats.skipped++;
        continue;
      }

      let files: string[];
      try {
        files = readdirSync(contentDir);
      } catch {
        stats.skipped++;
        continue;
      }

      if (files.length === 0) {
        stats.skipped++;
        continue;
      }

      // Process each file in the content folder
      for (const rawFilename of files) {
        const filename = normalizeFilename(rawFilename);
        const ext = extname(filename).toLowerCase().replace(/^\./, '');
        const filePath = join(contentDir, rawFilename);

        // Skip directories
        try {
          const stat = require("fs").statSync(filePath);
          if (stat.isDirectory()) continue;
        } catch {
          continue;
        }

        // Decide whether to include this file
        const isPdf = ext === 'pdf';
        const canConvert = isConvertible(ext);
        const shouldInclude = includeAll || isPdf || (doConvert && canConvert);

        if (!shouldInclude) {
          logger.debug("Skipping file (filtered)", { filename, ext });
          stats.skipped++;
          continue;
        }

        try {
          const fileData = readFileSync(filePath);

          if (isPdf) {
            // Cache PDF directly
            remoteCache.setFile(fileId, fileData, "pdf");
            stats.cached++;
            logger.debug("Cached PDF", { fileId, filename, size: fileData.length });
          } else if (canConvert && doConvert) {
            // Convert to PDF
            const result = await convertToPdf(filePath);
            if (result.success && result.pdfBuffer) {
              remoteCache.setFile(fileId, result.pdfBuffer, "pdf");
              stats.converted++;
              logger.debug("Converted and cached", { fileId, filename, size: result.pdfBuffer.length });
            } else {
              logger.warn("Conversion failed", { fileId, filename, error: result.error });
              if (includeAll) {
                // If includeAll, cache original even if conversion failed
                remoteCache.setFile(fileId, fileData, ext);
                stats.cached++;
              } else {
                stats.errors++;
              }
            }
          } else {
            // Cache with original extension (includeAll mode without conversion)
            remoteCache.setFile(fileId, fileData, ext);
            stats.cached++;
            logger.debug("Cached file", { fileId, filename, ext, size: fileData.length });
          }
        } catch (err) {
          logger.warn("Failed to process file", { fileId, filename, error: err });
          stats.errors++;
        }
      }
    }

    logger.info("Batch download complete", stats);
  } finally {
    // Cleanup temp directory
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch (err) {
      logger.debug("Failed to cleanup temp dir", { tempDir, error: err });
    }
  }

  return stats;
}
