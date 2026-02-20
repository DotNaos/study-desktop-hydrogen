import { createLogger } from '@aryazos/ts-base/logging';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { buildFileIndex } from './fileIndex';
import {
    createEmptyStore,
    ensureExportDir,
    loadExportStore,
    removeMapping,
    saveExportStore,
    upsertMapping,
} from './store';
import type {
    ExportFileIndex,
    ExportMappingRecord,
    ExportMappingStatusInfo,
    ExportStoreData,
} from './types';

const logger = createLogger('com.aryazos.study-sync.downloader.state');

let exportRoot: string | null = null;
let storeCache: ExportStoreData | null = null;
let indexCache: ExportFileIndex | null = null;
let onRootChanged: ((rootPath: string | null) => void) | null = null;

function normalizeRelativePath(relativePath: string): string {
    return relativePath.replace(/\\/g, '/');
}

export function getExportRoot(): string | null {
    return exportRoot;
}

export async function setExportRoot(rootPath: string | null): Promise<void> {
    if (!rootPath) {
        exportRoot = null;
        storeCache = null;
        indexCache = null;
        onRootChanged?.(null);
        return;
    }

    const stat = await fs.stat(rootPath);
    if (!stat.isDirectory()) {
        throw new Error('EXPORT_ROOT_NOT_DIRECTORY');
    }

    await ensureExportDir(rootPath);
    exportRoot = rootPath;
    storeCache = await loadExportStore(rootPath);
    indexCache = null;
    onRootChanged?.(rootPath);
    logger.info('Downloader root set', { rootPath });
}

export function onExportRootChanged(
    callback: (rootPath: string | null) => void,
): void {
    onRootChanged = callback;
}

export function clearExportRoot(): void {
    exportRoot = null;
    storeCache = null;
    indexCache = null;
    logger.info('Downloader root cleared');
}

function requireRoot(): string {
    if (!exportRoot) {
        throw new Error('EXPORT_ROOT_REQUIRED');
    }
    return exportRoot;
}

async function loadStore(): Promise<ExportStoreData> {
    const rootPath = requireRoot();
    if (!storeCache) {
        storeCache = await loadExportStore(rootPath);
    }
    return storeCache;
}

async function persistStore(store: ExportStoreData): Promise<void> {
    const rootPath = requireRoot();
    storeCache = store;
    await saveExportStore(rootPath, store);
}

export async function listMappings(): Promise<ExportMappingRecord[]> {
    const store = await loadStore();
    return [...store.mappings].sort((a, b) => {
        const aName = a.relativePath ? path.basename(a.relativePath) : '';
        const bName = b.relativePath ? path.basename(b.relativePath) : '';
        return aName.localeCompare(bName);
    });
}

export async function saveMapping(
    record: ExportMappingRecord,
): Promise<ExportMappingRecord> {
    const store = await loadStore();
    const normalized: ExportMappingRecord = {
        ...record,
        relativePath: record.relativePath
            ? normalizeRelativePath(record.relativePath)
            : undefined,
    };
    const next = upsertMapping(store, normalized);
    await persistStore(next);
    return normalized;
}

export async function deleteMapping(remoteId: string): Promise<void> {
    const store = await loadStore();
    const next = removeMapping(store, remoteId);
    await persistStore(next);
}

export async function buildIndex(): Promise<ExportFileIndex> {
    const rootPath = requireRoot();
    indexCache = await buildFileIndex(rootPath);
    return indexCache;
}

export async function getIndex(): Promise<ExportFileIndex> {
    if (!indexCache) {
        indexCache = await buildIndex();
    }
    return indexCache;
}

export async function getMappingStatuses(): Promise<ExportMappingStatusInfo[]> {
    const store = await loadStore();
    const index = await getIndex();
    const folderSet = new Set(index.folders);
    const foldersByName = new Map<string, string[]>();

    // Build inode map for self-healing
    // key: `${inode}:${deviceId}` -> ExportFileEntry
    const inodeMap = new Map<string, (typeof index.files)[0]>();

    // Helper to add to inode map
    const addToInodeMap = (entry: (typeof index.files)[0]) => {
        if (entry.inode && entry.deviceId) {
            inodeMap.set(`${entry.inode}:${entry.deviceId}`, entry);
        }
    };

    // We need to iterate all entries in byRelativePath to cover both files and folders
    for (const entry of index.byRelativePath.values()) {
        addToInodeMap(entry);
    }

    for (const folderPath of index.folders) {
        const name = path.basename(folderPath);
        const existing = foldersByName.get(name);
        if (existing) {
            existing.push(folderPath);
        } else {
            foldersByName.set(name, [folderPath]);
        }
    }

    const results: ExportMappingStatusInfo[] = [];

    for (const record of store.mappings) {
        const normalizedPath = record.relativePath
            ? normalizeRelativePath(record.relativePath)
            : null;
        let resolvedPath = normalizedPath;
        let status: ExportMappingStatusInfo['status'] = 'missing';

        // 1. Try exact path match
        if (normalizedPath) {
            const entry = index.byRelativePath.get(normalizedPath);
            const isFolder = folderSet.has(normalizedPath);

            if (entry || isFolder) {
                status = 'linked';
                // Update inode if missing in DB but present in file system (first heal)
                if (entry && (!record.inode || !record.deviceId)) {
                    await saveMapping({
                        ...record,
                        inode: entry.inode,
                        deviceId: entry.deviceId,
                        size: entry.size,
                        mtimeMs: entry.mtimeMs,
                    });
                }
            } else {
                // 2. Path missing, try Inode Match (Self-Healing)
                if (record.inode && record.deviceId) {
                    const key = `${record.inode}:${record.deviceId}`;
                    const match = inodeMap.get(key);
                    if (match) {
                        logger.info('Self-healing mapping detected', {
                            remoteId: record.remoteId,
                            oldPath: normalizedPath,
                            newPath: match.relativePath,
                        });

                        // Update DB immediately
                        const nextRecord = await saveMapping({
                            ...record,
                            relativePath: match.relativePath,
                            size: match.size,
                            mtimeMs: match.mtimeMs,
                            updatedAt: Date.now(),
                        });

                        resolvedPath = match.relativePath;
                        status = 'linked';
                        results.push({
                            record: nextRecord,
                            status: 'linked',
                            resolvedPath,
                        });
                        continue;
                    }
                }
            }
        }

        if (status === 'linked') {
            results.push({
                record,
                status: 'linked',
                resolvedPath: resolvedPath || undefined,
            });
            continue;
        }

        // 3. Fallback to name suggestions
        const filename = normalizedPath ? path.basename(normalizedPath) : '';
        const fileCandidates = filename
            ? (index.byName.get(filename) ?? [])
            : [];
        const folderCandidates = filename
            ? (foldersByName.get(filename) ?? [])
            : [];
        const candidates = [
            ...fileCandidates.map((entry) => entry.relativePath),
            ...folderCandidates,
        ];

        if (candidates.length === 0) {
            results.push({ record, status: 'missing' });
        } else if (candidates.length === 1) {
            results.push({
                record,
                status: normalizedPath ? 'missing' : 'linked', // If no path was set, link to candidate? existing logic conserved
                resolvedPath: candidates[0],
                suggestedPath: candidates[0],
            });
        } else {
            results.push({
                record,
                status: 'ambiguous',
                candidatePaths: candidates,
            });
        }
    }

    return results;
}

export function resolveAbsolutePath(relativePath: string): string {
    const rootPath = requireRoot();
    const resolved = path.resolve(rootPath, relativePath);
    const relative = path.relative(rootPath, resolved);

    if (relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error('EXPORT_PATH_OUTSIDE_ROOT');
    }

    return resolved;
}

export async function updateMappingLocation(
    remoteId: string,
    relativePath: string,
    stats?: {
        size?: number;
        mtimeMs?: number;
        inode?: number;
        deviceId?: number;
    },
): Promise<void> {
    const store = await loadStore();
    const existing = store.mappings.find(
        (record) => record.remoteId === remoteId,
    );
    const now = Date.now();

    const nextRecord: ExportMappingRecord = {
        remoteId,
        providerId: existing?.providerId,
        relativePath: normalizeRelativePath(relativePath),
        size: stats?.size ?? existing?.size,
        mtimeMs: stats?.mtimeMs ?? existing?.mtimeMs,
        inode: stats?.inode ?? existing?.inode,
        deviceId: stats?.deviceId ?? existing?.deviceId,
        updatedAt: now,
        lastSyncedAt: existing?.lastSyncedAt,
    };

    const nextStore = upsertMapping(store, nextRecord);
    await persistStore(nextStore);
}

export async function getStoreSnapshot(): Promise<ExportStoreData> {
    const store = await loadStore();
    return JSON.parse(JSON.stringify(store)) as ExportStoreData;
}

export function createDefaultRecord(params: {
    remoteId: string;
    providerId?: string;
    relativePath: string;
}): ExportMappingRecord {
    return {
        remoteId: params.remoteId,
        providerId: params.providerId,
        relativePath: normalizeRelativePath(params.relativePath),
        updatedAt: Date.now(),
    };
}

export function resetStore(): void {
    storeCache = createEmptyStore();
    indexCache = null;
}

// ============================================================================
// Ignore Rules (re-exported from store)
// ============================================================================

export {
    addIgnoreRule,
    clearAllData,
    deleteIgnoreRule,
    listIgnoreRules,
} from './store';

export type { IgnoreRule } from './types';

/**
 * Clear all mappings and ignore rules.
 * Also clears the in-memory caches.
 */
export async function clearAllMappingsAndRules(): Promise<void> {
    const rootPath = requireRoot();
    const { clearAllData: doClear } = await import('./store');
    await doClear(rootPath);
    storeCache = createEmptyStore();
    indexCache = null;
    logger.info('Cleared all mappings and rules');
}
