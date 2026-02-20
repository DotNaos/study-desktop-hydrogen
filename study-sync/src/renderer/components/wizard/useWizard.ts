import { createLogger } from '@aryazos/ts-base/logging';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ExportScan } from '../exporter/types';
import type {
    IgnoreRule,
    LocalStackItem,
    PredictionResult,
    WizardPhase,
} from './types';
import { useIgnoreRules } from './useIgnoreRules';

const port = new URLSearchParams(window.location.search).get('port') || '3333';
const apiBase = `http://localhost:${port}/api`;
const logger = createLogger('com.aryazos.study-sync.renderer.wizard');

export function useWizard() {
    const [phase, setPhase] = useState<WizardPhase>('idle');
    const [scan, setScan] = useState<ExportScan | null>(null);
    const [rootPath, setRootPath] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // Local stack: top-level folders/files from scan
    const [selectedStackItem, setSelectedStackItem] = useState<string | null>(
        null,
    );
    const [predictions, setPredictions] = useState<
        Record<string, PredictionResult[]>
    >({});
    const [ignoreRules, setIgnoreRules] = useState<IgnoreRule[]>([]);

    // Mapping state
    const [mappings, setMappings] = useState<Map<string, string>>(new Map());
    const { isPathIgnored } = useIgnoreRules(ignoreRules);

    const fetchJson = useCallback(
        async <T>(path: string, init?: RequestInit): Promise<T> => {
            const res = await fetch(`${apiBase}${path}`, init);
            if (!res.ok) {
                const payload = await res.json().catch(() => ({}));
                throw new Error(
                    payload?.error || `Request failed (${res.status})`,
                );
            }
            return res.json();
        },
        [],
    );

    const applyMappings = useCallback(
        (mappingsData: {
            mappings: { relativePath?: string; remoteId: string }[];
        }) => {
            const newMappings = new Map<string, string>();
            if (mappingsData.mappings) {
                for (const mapping of mappingsData.mappings) {
                    if (mapping.relativePath) {
                        newMappings.set(mapping.relativePath, mapping.remoteId);
                    }
                }
            }
            setMappings(newMappings);
        },
        [],
    );

    const refreshMappings = useCallback(async () => {
        try {
            const mappingsData = await fetchJson<{
                mappings: { relativePath?: string; remoteId: string }[];
            }>('/export/mappings');
            applyMappings(mappingsData);
        } catch (err) {
            setError((err as Error).message);
        }
    }, [applyMappings, fetchJson]);

    // Load initial data
    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // Get root path
            const rootData = await fetchJson<{ rootPath?: string }>(
                '/export/root',
            );
            setRootPath(rootData.rootPath ?? null);

            if (rootData.rootPath) {
                // Scan files
                const scanData = await fetchJson<ExportScan>('/export/scan', {
                    method: 'POST',
                });
                setScan(scanData);

                // Load ignore rules
                const rulesData = await fetchJson<{ rules: IgnoreRule[] }>(
                    '/export/ignore-rules',
                );
                setIgnoreRules(rulesData.rules || []);

                // Load mappings
                const mappingsData = await fetchJson<{
                    mappings: { relativePath?: string; remoteId: string }[];
                }>('/export/mappings');
                applyMappings(mappingsData);
            }
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    }, [applyMappings, fetchJson]);

    // Build local stack from scan
    const localStack = useMemo((): LocalStackItem[] => {
        if (!scan) return [];

        // Get top-level items only
        const topLevel = new Set<string>();
        for (const folder of scan.folders) {
            const parts = folder.split('/');
            if (parts.length === 1 && parts[0]) {
                topLevel.add(parts[0]);
            }
        }
        for (const file of scan.files) {
            const parts = file.relativePath.split('/');
            if (parts.length === 1) {
                topLevel.add(file.name);
            }
        }

        // Helper: check if an item (and all its descendants) are resolved
        const isFullyResolved = (
            itemPath: string,
            isFolder: boolean,
        ): boolean => {
            // Check if item matches an ignore rule
            const itemName = itemPath.split('/').pop() ?? itemPath;
            if (isPathIgnored(itemPath, itemName)) {
                return true;
            }

            // Check if item itself is mapped
            const selfMapped = mappings.has(itemPath);

            // For files, just check if mapped
            if (!isFolder) {
                return selfMapped;
            }

            // Get all direct children of this folder
            const childFolders = scan.folders.filter((f) => {
                const parts = f.split('/');
                // Direct child: starts with itemPath/ and has exactly one more part
                return (
                    f.startsWith(itemPath + '/') &&
                    parts.length === itemPath.split('/').length + 1
                );
            });

            const childFiles = scan.files.filter((f) => {
                const parts = f.relativePath.split('/');
                // Direct child: parent folder is itemPath
                return (
                    parts.length > 1 &&
                    parts.slice(0, -1).join('/') === itemPath
                );
            });

            // If no children, folder is resolved if mapped explicitly
            if (childFolders.length === 0 && childFiles.length === 0) {
                return selfMapped;
            }

            // Check all child folders recursively
            const allChildFoldersResolved = childFolders.every((f) =>
                isFullyResolved(f, true),
            );

            // Check all child files - mapped or ignored
            const allChildFilesResolved = childFiles.every(
                (f) =>
                    mappings.has(f.relativePath) ||
                    isPathIgnored(f.relativePath, f.name),
            );

            return allChildFoldersResolved && allChildFilesResolved;
        };

        return Array.from(topLevel)
            .map((name) => {
                const isFolder = scan.folders.includes(name);
                const mapping = mappings.get(name);
                const resolved = isFullyResolved(name, isFolder);
                return {
                    path: name,
                    name,
                    isFolder,
                    resolved,
                    remoteId: mapping,
                };
            })
            .sort((a, b) => {
                // Folders first, then alphabetically
                if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
                return a.name.localeCompare(b.name);
            });
    }, [scan, mappings, isPathIgnored]);

    // Get predictions for a local item
    const fetchPredictions = useCallback(
        async (localName: string, parentRemoteId?: string) => {
            try {
                const result = await fetchJson<{
                    predictions: PredictionResult[];
                }>('/export/predict', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ localName, parentRemoteId }),
                });
                setPredictions((prev) => ({
                    ...prev,
                    [localName]: result.predictions || [],
                }));
            } catch (err) {
                logger.error('Failed to fetch predictions', { error: err });
            }
        },
        [fetchJson],
    );

    // Accept a prediction
    const acceptPrediction = useCallback(
        async (localPath: string, remoteId: string, relativePath: string) => {
            try {
                await fetchJson('/export/mappings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ remoteId, relativePath }),
                });
                setMappings((prev) => new Map(prev).set(localPath, remoteId));
            } catch (err) {
                setError((err as Error).message);
            }
        },
        [fetchJson],
    );

    // Add ignore rule
    const addIgnoreRule = useCallback(
        async (rule: Omit<IgnoreRule, 'createdAt'>) => {
            try {
                const result = await fetchJson<{ rule: IgnoreRule }>(
                    '/export/ignore-rules',
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(rule),
                    },
                );
                setIgnoreRules((prev) => [result.rule, ...prev]);
            } catch (err) {
                setError((err as Error).message);
            }
        },
        [fetchJson],
    );

    // Delete ignore rule (by pattern)
    const deleteIgnoreRule = useCallback(
        async (pattern: string) => {
            try {
                await fetchJson(
                    `/export/ignore-rules/${encodeURIComponent(pattern)}`,
                    { method: 'DELETE' },
                );
                setIgnoreRules((prev) =>
                    prev.filter((r) => r.pattern !== pattern),
                );
            } catch (err) {
                setError((err as Error).message);
            }
        },
        [fetchJson],
    );

    // Clear all data
    const clearAllData = useCallback(async () => {
        try {
            await fetchJson('/export/clear', { method: 'POST' });
            setMappings(new Map());
            setIgnoreRules([]);
            setPredictions({});
            await loadData();
        } catch (err) {
            setError((err as Error).message);
        }
    }, [fetchJson, loadData]);

    // Trigger remote index
    const indexRemote = useCallback(async () => {
        setLoading(true);
        try {
            await fetchJson('/remote/index', { method: 'POST' });
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    }, [fetchJson]);

    // Select a stack item to expand
    const selectStackItem = useCallback(
        (path: string | null) => {
            setSelectedStackItem(path);
            if (path) {
                setPhase('resolving-local');
                // Fetch predictions for this item
                fetchPredictions(path);
            } else {
                setPhase('idle');
            }
        },
        [fetchPredictions],
    );

    // Load on mount
    useEffect(() => {
        loadData();
    }, [loadData]);

    // Download a remote file
    const downloadFile = useCallback(
        async (remoteId: string, relativePath?: string) => {
            try {
                const result = await fetchJson<{ ok: boolean; path?: string }>(
                    '/export/download',
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            remoteId,
                            relativePath,
                            overwrite: false,
                        }),
                    },
                );
                return result;
            } catch (err) {
                throw err;
            }
        },
        [fetchJson],
    );

    // Rename a local file
    const renameFile = useCallback(
        async (oldPath: string, newPath: string) => {
            try {
                await fetchJson('/export/rename', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ oldPath, newPath }),
                });
                // Reload to refresh local file list
                await loadData();
            } catch (err) {
                setError((err as Error).message);
                throw err;
            }
        },
        [fetchJson, loadData],
    );

    // Remove a mapping by remoteId
    const removeMapping = useCallback(
        async (remoteId: string) => {
            try {
                await fetchJson(
                    `/export/mappings/${encodeURIComponent(remoteId)}`,
                    {
                        method: 'DELETE',
                    },
                );
                // Update local state
                setMappings((prev) => {
                    const next = new Map(prev);
                    for (const [key, value] of next) {
                        if (value === remoteId) {
                            next.delete(key);
                            break;
                        }
                    }
                    return next;
                });
            } catch (err) {
                setError((err as Error).message);
                throw err;
            }
        },
        [fetchJson],
    );

    // Check if all local items are resolved
    const allLocalResolved = useMemo(() => {
        return (
            localStack.length > 0 && localStack.every((item) => item.resolved)
        );
    }, [localStack]);

    return {
        // State
        phase,
        scan,
        rootPath,
        error,
        loading,
        localStack,
        selectedStackItem,
        predictions,
        ignoreRules,
        mappings,
        allLocalResolved,

        // Actions
        loadData,
        refreshMappings,
        selectStackItem,
        fetchPredictions,
        acceptPrediction,
        addIgnoreRule,
        deleteIgnoreRule,
        clearAllData,
        indexRemote,
        downloadFile,
        renameFile,
        removeMapping,
        setPhase,
        setError,
    };
}
