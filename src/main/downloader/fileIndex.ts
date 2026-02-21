import { createLogger } from '@aryazos/ts-base/logging';
import { Dirent, promises as fs } from 'node:fs';
import path from 'node:path';
import type { ExportFileEntry, ExportFileIndex } from './types';

const logger = createLogger('com.aryazos.study-sync.export.index');

const IGNORED_DIRS = new Set(['.aryazos']);

function normalizeRelativePath(value: string): string {
    return value.replace(/\\/g, '/');
}

export async function buildFileIndex(
    rootPath: string,
): Promise<ExportFileIndex> {
    const files: ExportFileEntry[] = [];
    const folders: string[] = [];
    const folderEntries: ExportFileEntry[] = [];

    async function walk(
        currentPath: string,
        relativeBase: string,
    ): Promise<void> {
        let entries: Dirent[];

        try {
            entries = await fs.readdir(currentPath, { withFileTypes: true });
        } catch (error) {
            logger.warn('Failed to read directory', { error, currentPath });
            return;
        }

        for (const entry of entries) {
            if (entry.isSymbolicLink()) continue;

            const entryPath = path.join(currentPath, entry.name);
            const rawRelativePath = relativeBase
                ? path.join(relativeBase, entry.name)
                : entry.name;
            const relativePath = normalizeRelativePath(rawRelativePath);

            if (entry.isDirectory()) {
                if (IGNORED_DIRS.has(entry.name)) continue;
                folders.push(relativePath);

                // Track folder for inode mapping
                try {
                    const stat = await fs.stat(entryPath);
                    folderEntries.push({
                        relativePath,
                        name: entry.name,
                        size: stat.size,
                        mtimeMs: stat.mtimeMs,
                        inode: Number(stat.ino),
                        deviceId: Number(stat.dev),
                    });
                } catch (error) {
                    // ignore folder stat error
                }

                await walk(entryPath, relativePath);
                continue;
            }

            if (!entry.isFile()) continue;

            try {
                const stat = await fs.stat(entryPath);
                files.push({
                    relativePath,
                    name: entry.name,
                    size: stat.size,
                    mtimeMs: stat.mtimeMs,
                    inode: Number(stat.ino),
                    deviceId: Number(stat.dev),
                });
            } catch (error) {
                logger.warn('Failed to stat file', { error, entryPath });
            }
        }
    }

    await walk(rootPath, '');

    const byName = new Map<string, ExportFileEntry[]>();
    const byRelativePath = new Map<string, ExportFileEntry>();

    // Helper to add to maps
    const addToMaps = (entry: ExportFileEntry) => {
        byRelativePath.set(entry.relativePath, entry);
        const existing = byName.get(entry.name);
        if (existing) {
            existing.push(entry);
        } else {
            byName.set(entry.name, [entry]);
        }
    };

    files.forEach(addToMaps);
    folderEntries.forEach(addToMaps);

    return { files, folders, byName, byRelativePath };
}
