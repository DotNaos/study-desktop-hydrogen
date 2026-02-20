/**
 * Export API for downloading node trees as ZIP archives.
 *
 * Supports 4 export modes:
 * 1. Single file (no ZIP) - handled client-side, redirect to /nodes/:id/data
 * 2. Single file with parent folders - ZIP with folder structure
 * 3. Folder with all subfolders and files
 * 4. Folder structure only (no files)
 *
 * Query parameters:
 * - includeFiles: boolean (default: true) - include PDF files in export
 * - parentLevels: number (default: 0) - how many parent folders to include
 * - maxFiles: number (default: 5, max: 10) - limit on files to include
 */

import type { SyncNode } from '@aryazos/study/types';
import { createLogger } from '@aryazos/ts-base/logging';
import archiver from "archiver";
import { Router } from "express";
import { state as moodleState } from "../../moodle/state";
import { primaryProvider } from "../../providers";
import { remoteCache } from "../../remoteCache";
import { ProviderErrorCodes } from "../../types";
import { treeService } from "../tree";

const logger = createLogger("com.aryazos.study-sync.server.export");
const router = Router();

interface ExportContext {
  includeFiles: boolean;
  maxFiles: number;
  fileCount: number;
  archive: archiver.Archiver;
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

/**
 * Build parent path chain for a node.
 * Returns array of nodes from root to the requested parent level.
 */
async function getParentChain(nodeId: string, levels: number): Promise<SyncNode[]> {
  if (levels <= 0) return [];

  const chain: SyncNode[] = [];
  let currentId: string | null = nodeId;
  let depth = 0;

  while (currentId && depth < levels) {
    const node = await treeService.store.getNode(currentId);
    if (!node || !node.parent) break;

    const parent = await treeService.store.getNode(node.parent);
    if (!parent) break;

    chain.unshift(parent as SyncNode);
    currentId = parent.parent ?? null;
    depth++;
  }

  return chain;
}

/**
 * Build path string from parent chain.
 */
function buildPathFromChain(chain: SyncNode[]): string {
  return chain.map((n) => sanitizeName(n.name)).join("/");
}

/**
 * Recursively add a folder and its contents to the archive.
 */
async function addFolderToArchive(
  node: SyncNode,
  basePath: string,
  ctx: ExportContext
): Promise<void> {
  const folderPath = basePath ? `${basePath}/${sanitizeName(node.name)}` : sanitizeName(node.name);

  // Add empty directory entry
  ctx.archive.append("", { name: `${folderPath}/` });

  const children = await treeService.store.getChildren(node.id);

  for (const child of children as SyncNode[]) {
    if (isFolderNode(child)) {
      await addFolderToArchive(child, folderPath, ctx);
    } else if (ctx.includeFiles && ctx.fileCount < ctx.maxFiles) {
      await addFileToArchive(child, folderPath, ctx);
    }
  }
}

/**
 * Add a single file to the archive.
 */
async function addFileToArchive(
  node: SyncNode,
  basePath: string,
  ctx: ExportContext
): Promise<void> {
  if (ctx.fileCount >= ctx.maxFiles) return;

  const ext = node.fileExtension?.replace(/^\./, "") || "pdf";
  let fileName = sanitizeName(node.name);

  // Ensure correct extension
  if (!fileName.toLowerCase().endsWith(`.${ext.toLowerCase()}`)) {
    fileName = `${fileName}.${ext}`;
  }

  const filePath = basePath ? `${basePath}/${fileName}` : fileName;

  // Try to get file data
  let fileData: Buffer | null = null;

  if (remoteCache.hasFile(node.id, ext)) {
    fileData = remoteCache.getFile(node.id, ext);
  }

  if (!fileData) {
    // Try to materialize the file
    try {
      const materialized = await primaryProvider.materializeNode(node.id);
      if (materialized && remoteCache.hasFile(node.id, ext)) {
        fileData = remoteCache.getFile(node.id, ext);
      }
    } catch (err) {
      logger.warn("Failed to materialize file for export", { nodeId: node.id, error: err });
    }
  }

  if (fileData) {
    ctx.archive.append(fileData, { name: filePath });
    ctx.fileCount++;
    logger.debug("Added file to archive", { filePath, size: fileData.length });
  } else {
    logger.warn("Skipped file (no data available)", { nodeId: node.id, name: node.name });
  }
}

// Import ExportService
import { exportService } from "../../services/exportService";

/**
 * GET /api/nodes/:id/export
 *
 * Export a node (folder or file) as a ZIP archive.
 *
 * Query parameters:
 * - includeFiles: "true" | "false" (default: "true")
 * - parentLevels: number (default: 0)
 * - maxFiles: number (default: 5, max: 10)
 */
router.get("/nodes/:id/export", async (req, res) => {
  try {
    if (!primaryProvider.isAuthenticated()) {
      res.status(401).json({
        error: ProviderErrorCodes.AUTH_REQUIRED,
        message: "Not authenticated",
      });
      return;
    }

    const nodeId = req.params.id;
    const includeFiles = req.query.includeFiles !== "false";
    const parentLevels = Math.max(0, Math.min(Number(req.query.parentLevels) || 0, 10));
    const maxFiles = Math.max(1, Number(req.query.maxFiles) || 1000);
    const noConversion = req.query.noConversion === "true";
    const noFilter = req.query.noFilter === "true";

    // Set conversion options in moodle state for batch download
    // Managed by ExportService too, but we pass options there.
    // ExportService modifies state.

    await treeService.ensureBuilt();
    let node: any = await treeService.store.getNode(nodeId);

    // Fallback: Try fetching directly from provider (e.g. for root nodes/terms not in tree)
    if (!node) {
        try {
            const providerNode = await primaryProvider.getNode(nodeId);
            if (providerNode) {
                node = providerNode as SyncNode;
            }
        } catch (err) {
            logger.warn("Fallback provider lookup failed", { nodeId, error: err });
        }
    }

    if (!node) {
      res.status(404).json({
        error: ProviderErrorCodes.NOT_FOUND,
        message: "Node not found",
      });
      return;
    }

    // For single file without parent levels, redirect to data endpoint
    // (This behavior is preserved)
    if (!isFolderNode(node as SyncNode) && parentLevels === 0) {
      res.redirect(`/api/nodes/${nodeId}/data`);
      return;
    }

    // Determine archive name
    // ExportService doesn't set Content-Disposition headers on the stream, we must do it here.
    // We need parent chain for name?
    // ExportService calculates parent chain internally.
    // We can just name it after the node for now, or replicate parent chain logic just for naming?
    // Or we assume the user is happy with "NodeName.zip" if parentLevels=0.
    // If parentLevels > 0, we might want the top parent name.

    // Let's replicate simple naming checks or reuse sanitizeName (which is local here).

    // We can fetch parent chain just for naming if parentLevels > 0
    let archiveName = sanitizeName(node.name);
    if (parentLevels > 0) {
        const chain = await getParentChain(nodeId, parentLevels);
        if (chain.length > 0) {
            archiveName = sanitizeName(chain[0].name);
        }
    }

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${archiveName}.zip"`);

    // Delegate to ExportService
    await exportService.exportNodeToZip(
        node as SyncNode,
        {
          includeFiles,
          maxFiles,
          parentLevels,
          convertToPdf: !noConversion,
          includeAll: noFilter
        },
        res
    );

    // exportNodeToZip handles finalization and logging.

  } catch (error) {
    logger.error("Export failed", { error, nodeId: req.params.id });
    if (!res.headersSent) {
      res.status(500).json({ error: "Export failed" });
    }
  }
});

/**
 * GET /api/nodes/:id/export/info
 *
 * Get metadata about what would be exported without actually exporting.
 */
router.get("/nodes/:id/export/info", async (req, res) => {
  try {
    if (!primaryProvider.isAuthenticated()) {
      res.status(401).json({ error: ProviderErrorCodes.AUTH_REQUIRED });
      return;
    }

    const nodeId = req.params.id;
    const parentLevels = Math.max(0, Math.min(Number(req.query.parentLevels) || 0, 10));

    await treeService.ensureBuilt();
    const node = await treeService.store.getNode(nodeId);

    if (!node) {
      res.status(404).json({ error: ProviderErrorCodes.NOT_FOUND });
      return;
    }

    const parentChain = await getParentChain(nodeId, parentLevels);
    const syncNode = node as SyncNode;

    // Count folders and files recursively
    let folderCount = 0;
    let fileCount = 0;

    async function countChildren(n: SyncNode): Promise<void> {
      const children = await treeService.store.getChildren(n.id);
      for (const child of children as SyncNode[]) {
        if (isFolderNode(child)) {
          folderCount++;
          await countChildren(child);
        } else {
          fileCount++;
        }
      }
    }

    if (isFolderNode(syncNode)) {
      folderCount = 1; // Include the root folder
      await countChildren(syncNode);
    } else {
      fileCount = 1;
    }

    res.json({
      node: {
        id: node.id,
        name: node.name,
        type: node.type,
      },
      parentChain: parentChain.map((p) => ({
        id: p.id,
        name: p.name,
      })),
      folderCount,
      fileCount,
      isFolder: isFolderNode(syncNode),
    });
  } catch (error) {
    logger.error("Export info failed", { error, nodeId: req.params.id });
    res.status(500).json({ error: "Failed to get export info" });
  }
});

/**
 * POST /api/export/files
 *
 * Export multiple files by their IDs as a ZIP archive.
 * Files will be organized in their parent folder structure.
 *
 * Body:
 * - ids: string[] - array of file node IDs
 * - parentLevels: number (default: 0) - how many parent folders to include
 * - archiveName: string (default: "export") - name of the ZIP file
 */
router.post("/export/files", async (req, res) => {
  try {
    if (!primaryProvider.isAuthenticated()) {
      res.status(401).json({
        error: ProviderErrorCodes.AUTH_REQUIRED,
        message: "Not authenticated",
      });
      return;
    }

    const { ids, parentLevels: rawParentLevels, archiveName: rawArchiveName, noConversion, noFilter } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({
        error: "INVALID_REQUEST",
        message: "ids must be a non-empty array of node IDs",
      });
      return;
    }

    if (ids.length > 10) {
      res.status(400).json({
        error: "TOO_MANY_FILES",
        message: "Maximum 10 files can be exported at once",
      });
      return;
    }

    const parentLevels = Math.max(0, Math.min(Number(rawParentLevels) || 0, 10));
    const archiveName = sanitizeName(String(rawArchiveName || "export"));

    // Set conversion options in moodle state for batch download
    moodleState.conversionOptions.convertToPdf = !noConversion;
    moodleState.conversionOptions.includeAll = noFilter === true;

    await treeService.ensureBuilt();

    // Validate all nodes exist and are files
    const nodes: SyncNode[] = [];
    for (const id of ids) {
      const node = await treeService.store.getNode(id);
      if (!node) {
        res.status(404).json({
          error: ProviderErrorCodes.NOT_FOUND,
          message: `Node not found: ${id}`,
        });
        return;
      }
      if (isFolderNode(node as SyncNode)) {
        res.status(400).json({
          error: "INVALID_NODE_TYPE",
          message: `Cannot export folder with this endpoint: ${node.name}. Use /nodes/:id/export instead.`,
        });
        return;
      }
      nodes.push(node as SyncNode);
    }

    // Set response headers
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${archiveName}.zip"`);

    const archive = archiver("zip", { zlib: { level: 5 } });

    archive.on("error", (err) => {
      logger.error("Archive error", { error: err });
      if (!res.headersSent) {
        res.status(500).json({ error: "Archive creation failed" });
      }
    });

    archive.pipe(res);

    const ctx: ExportContext = {
      includeFiles: true,
      maxFiles: ids.length,
      fileCount: 0,
      archive,
    };

    // Track created paths to avoid duplicates
    const createdPaths = new Set<string>();

    for (const node of nodes) {
      // Get parent chain for this file
      const parentChain = await getParentChain(node.id, parentLevels);
      const parentPath = buildPathFromChain(parentChain);

      // Create parent folder entries if needed
      if (parentPath && !createdPaths.has(parentPath)) {
        // Create each level of the parent path
        const parts = parentPath.split("/");
        let currentPath = "";
        for (const part of parts) {
          currentPath = currentPath ? `${currentPath}/${part}` : part;
          if (!createdPaths.has(currentPath)) {
            archive.append("", { name: `${currentPath}/` });
            createdPaths.add(currentPath);
          }
        }
      }

      await addFileToArchive(node, parentPath, ctx);
    }

    await archive.finalize();

    logger.info("Batch file export completed", {
      fileIds: ids,
      parentLevels,
      filesExported: ctx.fileCount,
    });
  } catch (error) {
    logger.error("Batch file export failed", { error });
    if (!res.headersSent) {
      res.status(500).json({ error: "Export failed" });
    }
  }
});

export default router;
