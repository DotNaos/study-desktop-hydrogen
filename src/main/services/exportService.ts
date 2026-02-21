
import type { SyncNode } from '@aryazos/study/types';
import { createLogger } from '@aryazos/ts-base/logging';
import archiver from "archiver";
import { state as moodleState } from "../moodle/state";
import { primaryProvider } from "../providers";
import { remoteCache } from "../remoteCache";
import { isConvertible, shouldIncludeByDefault } from "./conversion";
import { listChildren } from "./studySyncService";

const logger = createLogger("com.aryazos.services.export");

export interface ExportOptions {
  includeFiles: boolean;
  maxFiles: number;
  parentLevels: number;
  convertToPdf?: boolean;
  includeAll?: boolean;
}

interface ExportContext extends ExportOptions {
  fileCount: number;
  archive: archiver.Archiver;
  addedPaths: Set<string>;
}

function isFolderNode(node: SyncNode): boolean {
  return node.type === "folder" || node.type === "composite";
}

function sanitizeName(name: string): string {
  // Normalize Unicode to NFC (canonical composition) to prevent duplicate entries
  // macOS uses NFD (decomposed) which can cause "duplicate" filenames in ZIP
  return name
    .normalize('NFC')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .trim() || "unnamed";
}

export class ExportService {
  async exportNodeToZip(
    node: SyncNode,
    options: ExportOptions,
    outputStream: NodeJS.WritableStream
  ): Promise<void> {
    // Configure global conversion options for provider
    // This expects the caller to be the exclusive user of the state during this op (CLI is single user)
    if (options.convertToPdf !== undefined) {
      moodleState.conversionOptions.convertToPdf = options.convertToPdf;
    }
    if (options.includeAll !== undefined) {
      moodleState.conversionOptions.includeAll = options.includeAll;
    }

    const archive = archiver("zip", {
      zlib: { level: 9 }, // Maximum compression
    });

    const context: ExportContext = {
      ...options,
      fileCount: 0,
      archive,
      addedPaths: new Set<string>(),
    };

    // Pipe archive data to the output stream
    archive.pipe(outputStream);

    try {
      // Node is passed directly, no need to lookup
      const nodeId = node.id;

      // 2. Build parent chain path if needed
      const parentChain = await this.getParentChain(nodeId, options.parentLevels);
      const parentPath = this.buildPathFromChain(parentChain);

      // 3. Add content
      if (isFolderNode(node)) {
        await this.addFolderToArchive(node, parentPath, context);
      } else {
        // Single file
        if (options.includeFiles) {
          await this.addFileToArchive(node, parentPath, context);
        }
      }

      await archive.finalize();
      logger.info("Export completed", { nodeId, fileCount: context.fileCount });
    } catch (error) {
      logger.error("Export failed", { nodeId: node.id, error });
      archive.abort(); // Signal error to stream
      throw error;
    }
  }

  private async getParentChain(nodeId: string, levels: number): Promise<SyncNode[]> {
    if (levels <= 0) return [];

    const chain: SyncNode[] = [];
    let currentId: string | null = nodeId;
    let depth = 0;

    // Load initial node to get parent
    const node = await remoteCache.getNode(nodeId);
    if (!node) return [];

    currentId = node.parent ?? null;

    while (currentId && depth < levels) {
      if (currentId === "root" || !currentId) break;

      const parent = await remoteCache.getNode(currentId);
      if (!parent) break;

      chain.unshift({
        id: parent.id,
        name: parent.name,
        type: parent.type,
        parent: parent.parent,
        providerId: parent.providerId
      } as SyncNode);

      currentId = parent.parent ?? null;
      depth++;
    }

    return chain;
  }

  private buildPathFromChain(chain: SyncNode[]): string {
    return chain.map((n) => sanitizeName(n.name)).join("/");
  }

  private async addFolderToArchive(
    node: SyncNode,
    basePath: string,
    ctx: ExportContext
  ): Promise<void> {
    const folderPath = basePath ? `${basePath}/${sanitizeName(node.name)}` : sanitizeName(node.name);
    const folderEntry = `${folderPath}/`;

    // Skip if already added (prevents duplicates from Unicode normalization issues)
    if (ctx.addedPaths.has(folderEntry)) {
      logger.debug("Skipping duplicate folder", { folderPath });
      return;
    }
    ctx.addedPaths.add(folderEntry);

    // Add empty directory entry to ensure folder exists even if empty
    ctx.archive.append("", { name: folderEntry });

    const children = await listChildren(node.id, false);

    for (const child of children) {
      if (isFolderNode(child)) {
        await this.addFolderToArchive(child, folderPath, ctx);
      } else if (ctx.includeFiles && ctx.fileCount < ctx.maxFiles) {
        // Check filtering
        const ext = (child.fileExtension || "").replace(/^\./, "").toLowerCase();
        if (!ctx.includeAll && !shouldIncludeByDefault(ext)) {
            continue;
        }

        await this.addFileToArchive(child, folderPath, ctx);
      }
    }
  }

  private async addFileToArchive(
    node: SyncNode,
    basePath: string,
    ctx: ExportContext
  ): Promise<void> {
    if (ctx.fileCount >= ctx.maxFiles) return;

    // Normalization of extension
    let ext = (node.fileExtension || "").replace(/^\./, "") || "pdf";
    // Check if conversion might change the extension to PDF
    if (moodleState.conversionOptions.convertToPdf && isConvertible(ext)) {
        ext = "pdf";
    }

    let fileName = sanitizeName(node.name);

    let fileData: Buffer | null = null;
    let finalExt = ext;

    try {
      // Calling materializeNode will trigger download & convert if not cached correctly
      // We use primaryProvider directly to ensure materialization happens
      const result = await primaryProvider.materializeNode(node.id);

      if (result) {
         finalExt = (result.fileExtension || ext).replace(/^\./, "");

         if (remoteCache.hasFile(node.id, finalExt)) {
             fileData = remoteCache.getFile(node.id, finalExt);
         }
      }
    } catch (err) {
      logger.warn("Failed to materialize file for export", { nodeId: node.id, error: err });
    }

    if (fileData) {
        // Fix filename extension
        if (!fileName.toLowerCase().endsWith(`.${finalExt.toLowerCase()}`)) {
             const oldExtRegex = new RegExp(`\\.\\w+$`);
             if (oldExtRegex.test(fileName)) {
                 fileName = fileName.replace(oldExtRegex, `.${finalExt}`);
             } else {
                 fileName = `${fileName}.${finalExt}`;
             }
        }

        const filePath = basePath ? `${basePath}/${fileName}` : fileName;

        // Skip if already added (prevents duplicates from Unicode normalization issues)
        if (ctx.addedPaths.has(filePath)) {
          logger.warn("Skipping duplicate file", { filePath, nodeId: node.id });
          return;
        }
        ctx.addedPaths.add(filePath);

        ctx.archive.append(fileData, { name: filePath });
        ctx.fileCount++;
        logger.debug("Added file to archive", { filePath, size: fileData.length });
    } else {
      logger.warn("Skipped file (no data available)", { nodeId: node.id, name: node.name });
    }
  }
}

export const exportService = new ExportService();
