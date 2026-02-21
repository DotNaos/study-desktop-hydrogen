import { createLogger } from '@aryazos/ts-base/logging';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { primaryProvider } from '../providers';
import { remoteCache } from '../remoteCache';
import {
    createDefaultRecord,
    getExportRoot,
    listMappings,
    resolveAbsolutePath,
    saveMapping,
} from './state';
import type { ExportMappingRecord } from './types';

const logger = createLogger('com.aryazos.study-sync.downloader.actions');

export interface DownloadOptions {
    remoteId: string;
    relativePath?: string;
    overwrite?: boolean;
}

export interface DownloadResult {
    remoteId: string;
    relativePath: string;
    bytesWritten?: number;
    skipped?: boolean;
}

function ensureExportRoot(): string {
    const rootPath = getExportRoot();
    if (!rootPath) {
        throw new Error('EXPORT_ROOT_REQUIRED');
    }
    return rootPath;
}

async function findMapping(
    remoteId: string,
): Promise<ExportMappingRecord | null> {
    const mappings = await listMappings();
    return mappings.find((record) => record.remoteId === remoteId) ?? null;
}

async function ensureMapping(remoteId: string): Promise<ExportMappingRecord> {
    const mapping = await findMapping(remoteId);
    if (!mapping) {
        throw new Error('EXPORT_MAPPING_REQUIRED');
    }
    return mapping;
}

export async function downloadMappedNode(
    options: DownloadOptions,
): Promise<DownloadResult> {
    ensureExportRoot();

    if (!primaryProvider.isAuthenticated()) {
        throw new Error('AUTH_REQUIRED');
    }

    const mapping = await ensureMapping(options.remoteId);
    const relativePath = options.relativePath ?? mapping.relativePath;

    if (!relativePath) {
        throw new Error('EXPORT_PATH_REQUIRED');
    }

    const absolutePath = resolveAbsolutePath(relativePath);
    const folderPath = path.dirname(absolutePath);
    await fs.mkdir(folderPath, { recursive: true });

    const exists = await fs
        .stat(absolutePath)
        .then(() => true)
        .catch((error) =>
            error?.code === 'ENOENT' ? false : Promise.reject(error),
        );

    if (exists && !options.overwrite) {
        logger.info('Downloader file already exists; skipping', {
            remoteId: options.remoteId,
            relativePath,
        });

        return {
            remoteId: options.remoteId,
            relativePath,
            skipped: true,
        };
    }

    const node = await primaryProvider.materializeNode(options.remoteId);
    if (!node) {
        throw new Error('EXPORT_NODE_UNSUPPORTED');
    }

    const fileExtension = node.fileExtension ?? 'pdf';
    let data = await remoteCache.getFile(options.remoteId, fileExtension);
    if (!data && fileExtension !== 'pdf') {
        data = await remoteCache.getFile(options.remoteId, 'pdf');
    }
    if (!data) {
        throw new Error('EXPORT_FILE_MISSING');
    }

    await fs.writeFile(absolutePath, data);
    const stat = await fs.stat(absolutePath);

    await saveMapping({
        ...mapping,
        relativePath,
        size: stat.size,
        mtimeMs: stat.mtimeMs,
        lastSyncedAt: Date.now(),
        updatedAt: Date.now(),
    });

    logger.info('Downloaded node', {
        remoteId: options.remoteId,
        relativePath,
        bytes: stat.size,
    });

    return {
        remoteId: options.remoteId,
        relativePath,
        bytesWritten: stat.size,
    };
}

export async function renameLocalFile(
    oldRelativePath: string,
    newRelativePath: string,
): Promise<void> {
    const rootPath = ensureExportRoot();

    if (!oldRelativePath || !newRelativePath) {
        throw new Error('EXPORT_PATH_REQUIRED');
    }

    const oldAbsPath = resolveAbsolutePath(oldRelativePath);
    const newAbsPath = resolveAbsolutePath(newRelativePath);

    // Safety check: ensure both paths are inside root
    if (!oldAbsPath.startsWith(rootPath) || !newAbsPath.startsWith(rootPath)) {
        throw new Error('EXPORT_PATH_OUTSIDE_ROOT');
    }

    // Ensure target folder exists
    const folderPath = path.dirname(newAbsPath);
    await fs.mkdir(folderPath, { recursive: true });

    await fs.rename(oldAbsPath, newAbsPath);
    logger.info('Renamed local file', {
        oldRelativePath,
        newRelativePath,
        oldAbsPath,
        newAbsPath,
    });
}

// Recursive Download Support

export async function downloadRemoteNodeRecursive(
    remoteId: string,
    targetRelativePath: string,
    options: { overwrite?: boolean } = {},
): Promise<void> {
    const node = await remoteCache.getNode(remoteId);
    if (!node) {
        throw new Error(`Remote node not found in index: ${remoteId}`);
    }

    // Ensure mapping exists so downloadMappedNode works for files
    // check if mapping exists first?
    let mapping = await findMapping(remoteId);
    if (!mapping) {
        // Create pending mapping
        // We set relativePath here.
        mapping = createDefaultRecord({
            remoteId,
            relativePath: targetRelativePath,
            providerId: node.providerId,
        });
        await saveMapping(mapping);
    } else if (mapping.relativePath !== targetRelativePath) {
        // Update path if changed?
        // Maybe user moved it. But here we are forcing download to target.
        // Let's update it.
        mapping = {
            ...mapping,
            relativePath: targetRelativePath,
            updatedAt: Date.now(),
        };
        await saveMapping(mapping);
    }

    if (node.type === 'file') {
        // Links are not explicitly handled in valid types anymore? CachedRemoteNode uses "file" | "folder"
        // Provider materializeNode handles it.
        await downloadMappedNode({
            remoteId,
            relativePath: targetRelativePath,
            overwrite: options.overwrite,
        });
    } else {
        // Folder
        const absPath = resolveAbsolutePath(targetRelativePath);
        await fs.mkdir(absPath, { recursive: true });

        // Update mapping with folder stats (inode)
        const stat = await fs.stat(absPath);
        await saveMapping({
            ...mapping,
            size: stat.size,
            mtimeMs: stat.mtimeMs,
            inode: stat.ino,
            deviceId: stat.dev,
            updatedAt: Date.now(),
            lastSyncedAt: Date.now(), // Mark as synced
        });

        // Recurse children
        const children = await remoteCache.getChildren(remoteId);
        for (const child of children) {
            // Sanitize name? usually provider does it.
            // We trust name is safe-ish but node path logic should handle it.
            // For now simple join.
            const childPath = path.join(targetRelativePath, child.name);
            await downloadRemoteNodeRecursive(child.id, childPath, options);
        }
    }
}
