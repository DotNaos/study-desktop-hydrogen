import { createLogger } from '@aryazos/ts-base/logging';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { exporterApi } from './exporterApi';
import type { ExportMappingStatusInfo, ExportScan, RemoteNode } from './types';
import { buildFileTree, getBasename, makeGroupNodeId } from './utils';

type DragState = {
    active: boolean;
    start: { x: number; y: number };
    current: { x: number; y: number };
    sourceId: string | null;
};

const logger = createLogger('com.aryazos.study-sync.renderer.exporter');

export function useExporter() {
    const [darkMode, setDarkMode] = useState(false);
    const [hideMapped, setHideMapped] = useState(true);
    const [draggedRemoteId, setDraggedRemoteId] = useState<string | null>(null);
    const [dragState, setDragState] = useState<DragState>({
        active: false,
        start: { x: 0, y: 0 },
        current: { x: 0, y: 0 },
        sourceId: null,
    });

    const [rootPath, setRootPath] = useState<string | null>(null);
    const [scan, setScan] = useState<ExportScan | null>(null);
    const [scanError, setScanError] = useState<string | null>(null);
    const [remoteError, setRemoteError] = useState<string | null>(null);

    const [remoteNodes, setRemoteNodes] = useState<Record<string, RemoteNode>>(
        {},
    );
    const [remoteChildren, setRemoteChildren] = useState<
        Record<string, string[]>
    >({ root: [] });
    const [expandedRemote, setExpandedRemote] = useState<
        Record<string, boolean>
    >({ root: true });
    const [loadingRemote, setLoadingRemote] = useState<Record<string, boolean>>(
        {},
    );

    const [selectedRemoteId, setSelectedRemoteId] = useState<string | null>(
        null,
    );
    const [selectedLocalPath, setSelectedLocalPath] = useState<string | null>(
        null,
    );
    const [isSelectingFolder, setIsSelectingFolder] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [fadeOut, setFadeOut] = useState(false);

    const [draftFilename, setDraftFilename] = useState<string>('');
    const [draftPath, setDraftPath] = useState<string>('');
    const [draftMessage, setDraftMessage] = useState<string | null>(null);

    const mappingById = useMemo(() => {
        const map = new Map<string, ExportMappingStatusInfo>();
        if (scan?.mappings) {
            for (const mapping of scan.mappings) {
                map.set(mapping.record.remoteId, mapping);
            }
        }
        return map;
    }, [scan]);

    const localTree = useMemo(() => {
        if (!scan) return null;
        return buildFileTree(scan.files || [], scan.folders || []);
    }, [scan]);

    const groupNodes = useMemo(() => {
        const next: Record<string, RemoteNode> = {};
        for (const [parentId, childIds] of Object.entries(remoteChildren)) {
            if (!childIds?.length) continue;
            for (const childId of childIds) {
                const child = remoteNodes[childId];
                if (!child?.group) continue;
                const groupId = makeGroupNodeId(parentId, child.group);
                if (!next[groupId]) {
                    next[groupId] = {
                        id: groupId,
                        name: child.group,
                        type: 'folder',
                        parent: parentId,
                        providerId: child.providerId,
                    };
                }
            }
        }
        return next;
    }, [remoteChildren, remoteNodes]);

    const displayNodes = useMemo(
        () => ({ ...remoteNodes, ...groupNodes }),
        [remoteNodes, groupNodes],
    );

    const nameOverrides = useMemo(() => {
        if (!selectedLocalPath) return undefined;
        if (!draftFilename) return undefined;
        const currentName = getBasename(selectedLocalPath);
        if (draftFilename === currentName) return undefined;
        return {
            [selectedLocalPath]: {
                name: draftFilename,
                stale: true,
            },
        };
    }, [selectedLocalPath, draftFilename]);

    const selectedRemote = selectedRemoteId
        ? displayNodes[selectedRemoteId]
        : null;
    const selectedMapping = selectedRemoteId
        ? (mappingById.get(selectedRemoteId) ?? null)
        : null;

    const mappedPaths = useMemo(() => {
        const set = new Set<string>();
        if (scan?.mappings) {
            for (const m of scan.mappings) {
                if (m.record.relativePath) set.add(m.record.relativePath);
            }
        }
        return set;
    }, [scan]);

    const isDirty = useMemo(() => {
        if (!selectedRemote) return false;
        const record = selectedMapping?.record;
        const currentFilename = record?.relativePath
            ? getBasename(record.relativePath)
            : selectedRemote.name;
        const currentPath = record?.relativePath || '';
        return draftFilename !== currentFilename || draftPath !== currentPath;
    }, [selectedRemote, selectedMapping, draftFilename, draftPath]);

    const loadRoot = async () => {
        try {
            const data = await exporterApi.loadRoot();
            setRootPath(data.rootPath ?? null);
        } catch {
            setRootPath(null);
        }
    };

    const scanExport = async () => {
        setScanError(null);
        try {
            const data = await exporterApi.scanExport();
            setScan(data);
            setRootPath(data.rootPath ?? null);
        } catch (error) {
            setScanError((error as Error).message);
            setScan(null);
        }
    };

    const loadRemoteRoot = async () => {
        setRemoteError(null);
        setLoadingRemote((prev) => ({ ...prev, root: true }));
        try {
            const nodes = await exporterApi.loadRemoteRoot();
            const nextNodes: Record<string, RemoteNode> = {};
            const childIds: string[] = [];
            for (const node of nodes) {
                nextNodes[node.id] = node;
                childIds.push(node.id);
            }
            setRemoteNodes(nextNodes);
            setRemoteChildren((prev) => ({ ...prev, root: childIds }));
        } catch (error) {
            setRemoteError((error as Error).message);
        } finally {
            setLoadingRemote((prev) => ({ ...prev, root: false }));
        }
    };

    const loadChildren = async (parentId: string) => {
        if (loadingRemote[parentId]) return;
        setLoadingRemote((prev) => ({ ...prev, [parentId]: true }));
        try {
            const nodes = await exporterApi.loadChildren(parentId);
            setRemoteNodes((prev) => {
                const next = { ...prev };
                for (const node of nodes) {
                    next[node.id] = node;
                }
                return next;
            });
            setRemoteChildren((prev) => ({
                ...prev,
                [parentId]: nodes.map((node) => node.id),
            }));
        } catch (error) {
            setRemoteError((error as Error).message);
        } finally {
            setLoadingRemote((prev) => ({ ...prev, [parentId]: false }));
        }
    };

    const toggleRemote = (nodeId: string) => {
        const isExpanded = expandedRemote[nodeId];
        setExpandedRemote((prev) => ({ ...prev, [nodeId]: !isExpanded }));
        if (!isExpanded && !remoteChildren[nodeId]) {
            loadChildren(nodeId);
        }
    };

    const handleCancelDraft = () => {
        if (!selectedRemote) return;
        const record = selectedMapping?.record;
        setDraftFilename(
            record?.relativePath
                ? getBasename(record.relativePath)
                : selectedRemote.name,
        );
        setDraftPath(record?.relativePath || '');
        setSelectedLocalPath(record?.relativePath ?? null);
        setDraftMessage(null);
    };

    const updateDraftFilename = (newName: string) => {
        setDraftFilename(newName);
        const nextPath = draftPath
            ? draftPath.split('/').slice(0, -1).concat(newName).join('/')
            : newName;
        setDraftPath(nextPath);
    };

    const handleSaveMapping = async () => {
        if (!selectedRemoteId) return;
        if (!draftFilename.trim()) {
            setDraftMessage('Local name is required.');
            return;
        }

        try {
            const trimmedDraftPath = draftPath.trim() || draftFilename.trim();
            const record = selectedMapping?.record;
            const oldPath =
                selectedLocalPath?.trim() || record?.relativePath || '';
            if (oldPath && trimmedDraftPath && oldPath !== trimmedDraftPath) {
                try {
                    await exporterApi.renameExport(oldPath, trimmedDraftPath);
                    setSelectedLocalPath(trimmedDraftPath);
                } catch (error) {
                    logger.warn('Failed to rename local file', {
                        error,
                        oldPath,
                        newPath: trimmedDraftPath,
                    });
                }
            }

            await exporterApi.saveMapping(selectedRemoteId, trimmedDraftPath);
            setDraftMessage('Mapping saved.');
            await scanExport();
        } catch (error) {
            setDraftMessage((error as Error).message);
        }
    };

    const handleDeleteMapping = async () => {
        if (!selectedRemoteId) return;
        try {
            await exporterApi.deleteMapping(selectedRemoteId);
            setDraftMessage('Mapping removed.');
            await scanExport();
        } catch (error) {
            setDraftMessage((error as Error).message);
        }
    };

    const handleDownload = async () => {
        if (!selectedRemoteId) return;
        try {
            await exporterApi.download(
                selectedRemoteId,
                draftPath.trim() || undefined,
            );
            setDraftMessage('Download complete.');
            await scanExport();
        } catch (error) {
            setDraftMessage((error as Error).message);
        }
    };

    const handleRemoteDragStart = (id: string, e: ReactMouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const rect = (e.target as HTMLElement).getBoundingClientRect();
        const start = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
        };
        setDragState({
            active: true,
            start,
            current: start,
            sourceId: id,
        });
        setSelectedRemoteId(id);
    };

    const handleLocalDrop = (path: string, remoteId?: string) => {
        const id = remoteId || draggedRemoteId;
        if (id) {
            setSelectedLocalPath(path);
            const name = path.split('/').pop() || '';
            setDraftPath(path);
            setDraftFilename(name);
            setDraftMessage(
                "Linked via drag & drop. Click 'Save mapping' to confirm.",
            );
            setDraggedRemoteId(null);
        }
    };

    const handleLocalSelect = (path: string) => {
        setSelectedLocalPath(path);
        if (selectedRemoteId || isSelectingFolder) {
            setDraftPath(path);
            const name = path.split('/').pop() || '';
            setDraftFilename(name);
            setDraftMessage(null);
            setIsSelectingFolder(false);
        }
    };

    const handleAutoLink = () => {
        if (selectedMapping?.suggestedPath) {
            setDraftPath(selectedMapping.suggestedPath);
            const name = selectedMapping.suggestedPath.split('/').pop() || '';
            setDraftFilename(name);
            setDraftMessage('Auto-filled from suggestion.');
        } else {
            setDraftMessage('No auto-suggestion available.');
        }
    };

    const handleToggleTheme = () => {
        const next = !darkMode;
        setDarkMode(next);
        if (window.studySync) {
            window.studySync.setTheme(next);
        }
    };

    const handleChooseFolder = () => {
        window.location.href = 'study-sync://select-export-root';
    };

    const handleRevealFolder = () => {
        window.location.href = 'study-sync://reveal-export-root';
    };

    const toggleSelectingFolder = () => {
        setIsSelectingFolder((prev) => !prev);
    };

    useEffect(() => {
        if (!selectedRemote) {
            setDraftFilename('');
            setDraftPath('');
            setDraftMessage(null);
            setSelectedLocalPath(null);
            return;
        }

        const record = selectedMapping?.record;
        setDraftFilename(
            record?.relativePath
                ? getBasename(record.relativePath)
                : selectedRemote.name,
        );
        setDraftPath(record?.relativePath || '');
        setSelectedLocalPath(record?.relativePath ?? null);
    }, [
        selectedRemoteId,
        selectedRemote?.name,
        selectedMapping?.record?.relativePath,
    ]);

    useEffect(() => {
        setDraftMessage(null);
    }, [selectedRemoteId]);

    useEffect(() => {
        if (!dragState.active) return;

        const handleMouseMove = (e: globalThis.MouseEvent) => {
            setDragState((prev) => ({
                ...prev,
                current: { x: e.clientX, y: e.clientY },
            }));
        };

        const handleMouseUp = (e: globalThis.MouseEvent) => {
            if (dragState.active && dragState.sourceId) {
                const elements = document.elementsFromPoint(
                    e.clientX,
                    e.clientY,
                );
                const dropTarget = elements.find((el) =>
                    el.hasAttribute('data-path'),
                );

                if (dropTarget) {
                    const path = dropTarget.getAttribute('data-path');
                    if (path) {
                        handleLocalDrop(path, dragState.sourceId);
                    }
                }
            }
            setDragState((prev) => ({
                ...prev,
                active: false,
                sourceId: null,
            }));
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [dragState.active, dragState.sourceId]);

    useEffect(() => {
        const loadData = async () => {
            const startTime = Date.now();

            await Promise.all([loadRoot(), loadRemoteRoot()]);

            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, 300 - elapsed);

            setTimeout(() => {
                setFadeOut(true);
                setTimeout(() => setInitialLoading(false), 300);
            }, remaining);
        };

        loadData();

        if (window.studySync) {
            window.studySync.getTheme().then((isDark: boolean) => {
                setDarkMode(isDark);
            });

            return window.studySync.onThemeChanged((isDark: boolean) => {
                setDarkMode(isDark);
            });
        }
    }, []);

    useEffect(() => {
        if (rootPath) {
            scanExport();
        }
    }, [rootPath]);

    useEffect(() => {
        if (darkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [darkMode]);

    return {
        darkMode,
        rootPath,
        hideMapped,
        remoteError,
        loadingRemote,
        remoteNodes: displayNodes,
        remoteChildren,
        expandedRemote,
        mappingById,
        selectedRemoteId,
        selectedRemote,
        selectedMapping,
        draftFilename,
        draftPath,
        draftMessage,
        isDirty,
        isSelectingFolder,
        scanError,
        localTree,
        mappedPaths,
        nameOverrides,
        selectedLocalPath,
        dragState,
        initialLoading,
        fadeOut,
        setHideMapped,
        setSelectedRemoteId,
        toggleRemote,
        handleRemoteDragStart,
        handleLocalSelect,
        handleLocalDrop,
        handleSaveMapping,
        handleCancelDraft,
        handleDownload,
        handleDeleteMapping,
        handleAutoLink,
        updateDraftFilename,
        toggleSelectingFolder,
        scanExport,
        loadRemoteRoot,
        handleToggleTheme,
        handleChooseFolder,
        handleRevealFolder,
    };
}
