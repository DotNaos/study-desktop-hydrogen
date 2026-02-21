/**
 * Tree-based Export API for downloading specified file trees as ZIP archives.
 *
 * POST /api/export/tree
 *
 * The client sends the complete tree structure to export. The backend builds
 * the exact ZIP structure from this tree, ensuring what you see is what you get.
 */

import { createLogger } from '@aryazos/ts-base/logging';
import archiver from "archiver";
import { Router } from "express";
import { primaryProvider } from "../../providers";
import { remoteCache } from "../../remoteCache";
import { ProviderErrorCodes } from "../../types";

const logger = createLogger("com.aryazos.study-sync.server.exportTree");
const router = Router();

// Types matching the API contract
interface ExportNode {
  type: "folder" | "file";
  name: string;
  id?: string;
  children?: ExportNode[];
}

interface ExportTreeRequest {
  archiveName: string;
  tree: ExportNode[];
}

function sanitizeName(name: string): string {
  // Normalize Unicode to NFC (canonical composition) to prevent duplicate entries
  // macOS uses NFD (decomposed) which can cause "duplicate" filenames in ZIP
  return name
    .normalize('NFC')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .trim() || "unnamed";
}

/**
 * Recursively extract all file IDs from the tree.
 */
function extractFileIds(nodes: ExportNode[]): string[] {
  const ids: string[] = [];

  function traverse(node: ExportNode): void {
    if (node.type === "file" && node.id) {
      ids.push(node.id);
    }
    if (node.children) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  for (const node of nodes) {
    traverse(node);
  }

  return ids;
}

/**
 * Ensure all files are available in cache, downloading if necessary.
 */
async function ensureFilesInCache(fileIds: string[]): Promise<void> {
  for (const id of fileIds) {
    // Check if already cached (try common extensions)
    const extensions = ["pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx"];
    let cached = false;

    for (const ext of extensions) {
      if (remoteCache.hasFile(id, ext)) {
        cached = true;
        break;
      }
    }

    if (!cached) {
      // Materialize the node (triggers download + conversion)
      try {
        await primaryProvider.materializeNode(id);
        logger.debug("Materialized file for export", { id });
      } catch (err) {
        logger.warn("Failed to materialize file", { id, error: err });
      }
    }
  }
}

/**
 * Get file data from cache for a given ID.
 */
function getFileFromCache(id: string): { data: Buffer; ext: string } | null {
  const extensions = ["pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx"];

  for (const ext of extensions) {
    if (remoteCache.hasFile(id, ext)) {
      const data = remoteCache.getFile(id, ext);
      if (data) {
        return { data, ext };
      }
    }
  }

  return null;
}

/**
 * Recursively build ZIP from tree structure.
 */
async function buildZipFromTree(
  nodes: ExportNode[],
  basePath: string,
  archive: archiver.Archiver,
  addedPaths: Set<string> = new Set()
): Promise<{ filesAdded: number; filesSkipped: number }> {
  let filesAdded = 0;
  let filesSkipped = 0;

  for (const node of nodes) {
    const sanitizedName = sanitizeName(node.name);

    if (node.type === "folder") {
      const folderPath = basePath ? `${basePath}/${sanitizedName}` : sanitizedName;
      const folderEntry = `${folderPath}/`;

      // Skip if already added (prevents duplicates from Unicode normalization issues)
      if (addedPaths.has(folderEntry)) {
        logger.debug("Skipping duplicate folder", { folderPath });
        continue;
      }
      addedPaths.add(folderEntry);

      // Add empty folder entry
      archive.append("", { name: folderEntry });

      // Process children recursively
      if (node.children && node.children.length > 0) {
        const result = await buildZipFromTree(node.children, folderPath, archive, addedPaths);
        filesAdded += result.filesAdded;
        filesSkipped += result.filesSkipped;
      }
    } else if (node.type === "file" && node.id) {
      // Get file from cache
      const cached = getFileFromCache(node.id);

      if (cached) {
        // Build filename with extension
        let fileName = sanitizedName;
        if (!fileName.toLowerCase().endsWith(`.${cached.ext.toLowerCase()}`)) {
          fileName = `${fileName}.${cached.ext}`;
        }

        const filePath = basePath ? `${basePath}/${fileName}` : fileName;

        // Skip if already added (prevents duplicates from Unicode normalization issues)
        if (addedPaths.has(filePath)) {
          logger.warn("Skipping duplicate file", { filePath, id: node.id });
          filesSkipped++;
          continue;
        }
        addedPaths.add(filePath);

        archive.append(cached.data, { name: filePath });
        filesAdded++;
        logger.debug("Added file to archive", { filePath, size: cached.data.length });
      } else {
        filesSkipped++;
        logger.warn("Skipped file (not in cache)", { id: node.id, name: node.name });
      }
    }
  }

  return { filesAdded, filesSkipped };
}

/**
 * POST /api/export/tree
 *
 * Export a tree structure as a ZIP archive.
 *
 * Request body:
 * - archiveName: string - name of the ZIP file (without extension)
 * - tree: ExportNode[] - the tree structure to export
 */
router.post("/export/tree", async (req, res) => {
  try {
    if (!primaryProvider.isAuthenticated()) {
      res.status(401).json({
        error: ProviderErrorCodes.AUTH_REQUIRED,
        message: "Not authenticated",
      });
      return;
    }

    const { archiveName: rawArchiveName, tree } = req.body as ExportTreeRequest;

    // Validate request
    if (!tree || !Array.isArray(tree)) {
      res.status(400).json({
        error: "INVALID_REQUEST",
        message: "tree must be an array of ExportNode objects",
      });
      return;
    }

    const archiveName = sanitizeName(rawArchiveName || "export");

    logger.info("Starting tree export", { archiveName, nodeCount: tree.length });

    // 1. Extract all file IDs from tree
    const fileIds = extractFileIds(tree);
    logger.debug("Files to export", { count: fileIds.length });

    // 2. Ensure all files are in cache
    await ensureFilesInCache(fileIds);

    // 3. Build ZIP from tree structure
    const archive = archiver("zip", { zlib: { level: 9 } });

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${archiveName}.zip"`);

    archive.on("error", (err) => {
      logger.error("Archive error", { error: err });
      if (!res.headersSent) {
        res.status(500).json({ error: "Archive creation failed" });
      }
    });

    archive.pipe(res);

    const { filesAdded, filesSkipped } = await buildZipFromTree(tree, "", archive);

    await archive.finalize();

    logger.info("Tree export completed", {
      archiveName,
      filesAdded,
      filesSkipped,
    });
  } catch (error) {
    logger.error("Tree export failed", { error });
    if (!res.headersSent) {
      res.status(500).json({ error: "Export failed" });
    }
  }
});

export default router;
