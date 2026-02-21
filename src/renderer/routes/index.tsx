import { createFileRoute } from '@tanstack/react-router';
import {
    ArrowLeftFromLine,
    ArrowRightFromLine,
    GripVertical,
    LayoutGrid,
    List,
    Loader2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { TreemapCanvas } from '../app/components/TreemapCanvas';
import {
    buildInitialCompletionMap,
    collectResourceIds,
    flattenNodes,
    isResourceNode,
    type ExplorerNode,
} from '../app/treeUtils';
import { transformCoursesToZoomData } from '../app/zoomData';
import { cn } from '../shared/lib/utils';
import { readJson, resolveApiBase } from './home/api';
import { ExportDialog } from './home/ExportDialog';
import { ExplorerTree } from './home/ExplorerTree';
import { LoginGate } from './home/LoginGate';
import {
    type AuthStatusResponse,
    type ExportMode,
    type LoginResponse,
    type ViewMode,
} from './home/types';
import { useSplitPanels } from './home/useSplitPanels';

export const Route = createFileRoute('/')({
    component: Home,
});

function Home() {
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [apiBase, setApiBase] = useState<string>('');
    const [authStatus, setAuthStatus] = useState<AuthStatusResponse | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [authError, setAuthError] = useState<string | null>(null);
    const [loginUsername, setLoginUsername] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [loginSubmitting, setLoginSubmitting] = useState(false);

    const [roots, setRoots] = useState<ExplorerNode[]>([]);
    const [treeLoading, setTreeLoading] = useState(false);
    const [treeError, setTreeError] = useState<string | null>(null);
    const [completionMap, setCompletionMap] = useState<Map<string, boolean>>(
        () => new Map(),
    );
    const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
    const [selectedResourceId, setSelectedResourceId] = useState<string | null>(
        null,
    );
    const [completionBusyId, setCompletionBusyId] = useState<string | null>(null);

    const [exportNode, setExportNode] = useState<ExplorerNode | null>(null);
    const [exportMode, setExportMode] = useState<ExportMode | null>(null);
    const [exportError, setExportError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    const nodeMap = useMemo(() => {
        return new Map(flattenNodes(roots).map((node) => [node.id, node]));
    }, [roots]);

    const selectedResource = useMemo(() => {
        if (!selectedResourceId) {
            return null;
        }
        const node = nodeMap.get(selectedResourceId);
        if (!node || !isResourceNode(node)) {
            return null;
        }
        return node;
    }, [nodeMap, selectedResourceId]);

    const rootsWithCompletion = useMemo(() => {
        const apply = (node: ExplorerNode): ExplorerNode => {
            const children = node.children?.map(apply);
            if (isResourceNode(node)) {
                const completed = completionMap.get(node.id);
                if (typeof completed === 'boolean') {
                    return {
                        ...node,
                        progress: completed ? 100 : 0,
                        isCompleted: completed,
                        children,
                    };
                }
            }
            return {
                ...node,
                children,
            };
        };

        return roots.map(apply);
    }, [roots, completionMap]);

    const treemapData = useMemo(
        () => transformCoursesToZoomData(rootsWithCompletion as any),
        [rootsWithCompletion],
    );

    const viewerSrc = selectedResource
        ? `${apiBase}/nodes/${encodeURIComponent(selectedResource.id)}/data`
        : null;

    const hasViewerContent = Boolean(viewerSrc && selectedResource);
    const {
        panelMode,
        setPanelMode,
        splitContainerRef,
        isSplitMode,
        explorerWidthPct,
        viewerWidthPct,
        shouldAnimatePanels,
        onResizeStart,
        stopResize,
    } = useSplitPanels({
        hasViewerContent,
        selectedResourceId,
    });

    const openResource = useCallback(
        (resourceId: string) => {
            setSelectedResourceId(resourceId);
            setPanelMode((prev) => (prev === 'explorer-only' ? 'split' : prev));
        },
        [setPanelMode],
    );

    const loadTree = useCallback(async () => {
        if (!apiBase) {
            return;
        }

        setTreeLoading(true);
        setTreeError(null);
        try {
            const response = await fetch(`${apiBase}/nodes?mode=tree`);
            if (response.status === 401) {
                setAuthStatus((prev) => ({
                    authenticated: false,
                    error: 'AUTH_REQUIRED',
                    selectedSchool: prev?.selectedSchool ?? null,
                    hasStoredCredentials: prev?.hasStoredCredentials ?? false,
                }));
                return;
            }
            if (!response.ok) {
                throw new Error(`Tree load failed (${response.status})`);
            }

            const tree = (await readJson<ExplorerNode[]>(response)) || [];
            setRoots(tree);
            setCompletionMap(buildInitialCompletionMap(tree));
            setExpandedIds((prev) => {
                if (prev.size > 0) {
                    return prev;
                }
                return new Set(tree.map((node) => node.id));
            });

            const nodeIds = new Set(flattenNodes(tree).map((node) => node.id));
            setSelectedResourceId((prev) =>
                prev && nodeIds.has(prev) ? prev : null,
            );
        } catch (error) {
            setTreeError(
                error instanceof Error
                    ? error.message
                    : 'Kursstruktur konnte nicht geladen werden.',
            );
        } finally {
            setTreeLoading(false);
        }
    }, [apiBase]);

    const loadAuthStatus = useCallback(async () => {
        if (!apiBase) {
            return;
        }
        setAuthLoading(true);
        setAuthError(null);
        try {
            const response = await fetch(`${apiBase}/auth/status`);
            if (!response.ok) {
                throw new Error(`Auth status failed (${response.status})`);
            }
            const status = await readJson<AuthStatusResponse>(response);
            setAuthStatus(status);
            if (status.authenticated) {
                void loadTree();
            }
        } catch (error) {
            setAuthError(
                error instanceof Error
                    ? error.message
                    : 'Authentifizierungsstatus konnte nicht geladen werden.',
            );
        } finally {
            setAuthLoading(false);
        }
    }, [apiBase, loadTree]);

    useEffect(() => {
        void resolveApiBase().then((value) => setApiBase(value));
    }, []);

    useEffect(() => {
        if (!apiBase) {
            return;
        }
        void loadAuthStatus();
    }, [apiBase, loadAuthStatus]);

    const onLogin = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!loginUsername.trim() || !loginPassword.trim()) {
            setAuthError('Bitte Username und Passwort eingeben.');
            return;
        }

        setLoginSubmitting(true);
        setAuthError(null);

        try {
            const response = await fetch(`${apiBase}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: loginUsername.trim(),
                    password: loginPassword,
                }),
            });
            const payload = await readJson<LoginResponse>(response);

            if (!response.ok || !payload.ok || payload.authenticated === false) {
                throw new Error(payload.error || 'LOGIN_FAILED');
            }

            setAuthStatus((prev) => ({
                authenticated: true,
                error: null,
                selectedSchool: prev?.selectedSchool ?? null,
                hasStoredCredentials: true,
            }));
            setLoginPassword('');
            await loadTree();
        } catch (error) {
            setAuthError(
                error instanceof Error
                    ? error.message
                    : 'Login fehlgeschlagen. Credentials prüfen.',
            );
        } finally {
            setLoginSubmitting(false);
        }
    };

    const toggleExpanded = (nodeId: string) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(nodeId)) {
                next.delete(nodeId);
            } else {
                next.add(nodeId);
            }
            return next;
        });
    };

    const persistCompletion = async (
        node: ExplorerNode,
        completed: boolean,
    ): Promise<void> => {
        const ids = collectResourceIds(node);
        if (ids.length === 0) {
            return;
        }

        setCompletionBusyId(node.id);
        setNotice(null);
        setTreeError(null);
        try {
            if (ids.length === 1) {
                const response = await fetch(
                    `${apiBase}/nodes/${encodeURIComponent(ids[0])}/completion`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ completed }),
                    },
                );
                if (!response.ok) {
                    throw new Error(`Completion update failed (${response.status})`);
                }
            } else {
                const updates = Object.fromEntries(ids.map((id) => [id, completed]));
                const response = await fetch(`${apiBase}/nodes/completion/batch`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ updates }),
                });
                if (!response.ok) {
                    throw new Error(`Batch completion failed (${response.status})`);
                }
            }

            setCompletionMap((prev) => {
                const next = new Map(prev);
                for (const id of ids) {
                    next.set(id, completed);
                }
                return next;
            });

            setNotice(
                completed
                    ? `${ids.length} Ressource(n) als erledigt markiert`
                    : `${ids.length} Ressource(n) als unerledigt markiert`,
            );
        } catch (error) {
            setTreeError(
                error instanceof Error
                    ? error.message
                    : 'Completion konnte nicht gespeichert werden.',
            );
        } finally {
            setCompletionBusyId(null);
        }
    };

    const openExportDialog = (node: ExplorerNode) => {
        setExportNode(node);
        setExportMode(null);
        setExportError(null);
    };

    const runExport = async (mode: ExportMode) => {
        if (!exportNode) {
            return;
        }
        setExportMode(mode);
        setExportError(null);
        setNotice(null);

        try {
            if (mode === 'saveAs') {
                const result = await window.studySync?.exportSaveAs?.(exportNode.id);
                if (!result) {
                    throw new Error('EXPORT_BRIDGE_UNAVAILABLE');
                }
                if (!result.ok) {
                    if (result.cancelled) {
                        setExportNode(null);
                        return;
                    }
                    throw new Error(result.error || 'EXPORT_SAVE_AS_FAILED');
                }
                setNotice(`Export gespeichert: ${result.fileCount ?? 0} Datei(en)`);
            } else {
                const result = await window.studySync?.exportShare?.(exportNode.id);
                if (!result) {
                    throw new Error('EXPORT_BRIDGE_UNAVAILABLE');
                }
                if (!result.ok) {
                    throw new Error(result.error || 'EXPORT_SHARE_FAILED');
                }
                setNotice(`Share-ZIP erstellt: ${result.fileCount ?? 0} Datei(en)`);
            }

            setExportNode(null);
        } catch (error) {
            setExportError(
                error instanceof Error ? error.message : 'Export fehlgeschlagen.',
            );
        } finally {
            setExportMode(null);
        }
    };

    if (authLoading || !apiBase) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
                <div className="flex items-center gap-3 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Initialisiere App...
                </div>
            </div>
        );
    }

    if (!authStatus?.authenticated) {
        return (
            <LoginGate
                authError={authError}
                authStatusError={authStatus?.error ?? null}
                loginUsername={loginUsername}
                loginPassword={loginPassword}
                loginSubmitting={loginSubmitting}
                onUsernameChange={setLoginUsername}
                onPasswordChange={setLoginPassword}
                onSubmit={onLogin}
            />
        );
    }

    return (
        <div className="h-screen flex flex-col bg-slate-950 text-slate-100">
            <header className="h-12 border-b border-slate-800 flex items-center justify-between px-4">
                <div className="text-sm font-medium tracking-wide">Study Desktop</div>
                <div className="text-xs text-slate-400">
                    {authStatus.selectedSchool || 'moodle'}
                </div>
            </header>

            {(notice || treeError) && (
                <div
                    className={cn(
                        'px-4 py-2 text-sm border-b',
                        treeError
                            ? 'bg-rose-900/20 text-rose-300 border-rose-900/40'
                            : 'bg-emerald-900/20 text-emerald-300 border-emerald-900/40',
                    )}
                >
                    {treeError || notice}
                </div>
            )}

            <main className="flex-1 min-h-0">
                <div ref={splitContainerRef} className="h-full w-full flex min-w-0">
                    <section
                        style={{ width: `${explorerWidthPct}%` }}
                        className={cn(
                            'h-full min-w-0 flex flex-col overflow-hidden',
                            shouldAnimatePanels && 'transition-[width] duration-220 ease-out',
                            hasViewerContent &&
                                explorerWidthPct > 0 &&
                                'border-r border-slate-800',
                            explorerWidthPct <= 0.01 && 'pointer-events-none',
                        )}
                    >
                        <div className="h-11 border-b border-slate-800 px-3 flex items-center justify-between gap-3">
                            <div className="text-sm font-medium">Explorer</div>
                            <div className="flex items-center gap-2">
                                <div className="flex items-center rounded-lg border border-slate-700 overflow-hidden">
                                    <button
                                        type="button"
                                        onClick={() => setViewMode('list')}
                                        className={cn(
                                            'px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors',
                                            viewMode === 'list'
                                                ? 'bg-slate-200 text-slate-900'
                                                : 'bg-slate-900 text-slate-300 hover:bg-slate-800',
                                        )}
                                    >
                                        <List className="h-3.5 w-3.5" />
                                        Liste
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setViewMode('grid')}
                                        className={cn(
                                            'px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors border-l border-slate-700',
                                            viewMode === 'grid'
                                                ? 'bg-slate-200 text-slate-900'
                                                : 'bg-slate-900 text-slate-300 hover:bg-slate-800',
                                        )}
                                    >
                                        <LayoutGrid className="h-3.5 w-3.5" />
                                        Grid
                                    </button>
                                </div>

                                {selectedResource && (
                                    <button
                                        type="button"
                                        title={
                                            panelMode === 'explorer-only'
                                                ? 'Split View'
                                                : 'Explorer fullscreen'
                                        }
                                        onClick={() => {
                                            stopResize();
                                            setPanelMode((prev) =>
                                                prev === 'explorer-only'
                                                    ? 'split'
                                                    : 'explorer-only',
                                            );
                                        }}
                                        className="rounded-md border border-slate-700 p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white"
                                    >
                                        {panelMode === 'explorer-only' ? (
                                            <ArrowLeftFromLine className="h-4 w-4" />
                                        ) : (
                                            <ArrowRightFromLine className="h-4 w-4" />
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 min-h-0">
                            {viewMode === 'list' ? (
                                <div className="h-full overflow-auto">
                                    <div className="px-3 py-2 text-xs uppercase tracking-wider text-slate-500">
                                        Semester / Kurse / Wochen / Ressourcen
                                    </div>

                                    {treeLoading ? (
                                        <div className="px-3 py-4 text-sm text-slate-400 flex items-center gap-2">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Lade Inhalte...
                                        </div>
                                    ) : roots.length === 0 ? (
                                        <div className="px-3 py-4 text-sm text-slate-400">
                                            Keine Inhalte gefunden.
                                        </div>
                                    ) : (
                                        <div className="px-2 pb-3">
                                            <ExplorerTree
                                                roots={roots}
                                                completionMap={completionMap}
                                                expandedIds={expandedIds}
                                                selectedResourceId={selectedResourceId}
                                                completionBusyId={completionBusyId}
                                                onToggleExpanded={toggleExpanded}
                                                onOpenResource={openResource}
                                                onPersistCompletion={(node, completed) => {
                                                    void persistCompletion(node, completed);
                                                }}
                                                onOpenExportDialog={openExportDialog}
                                            />
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="h-full min-h-[320px]">
                                    {treeLoading ? (
                                        <div className="h-full flex items-center justify-center text-sm text-slate-400">
                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                            Lade Inhalte...
                                        </div>
                                    ) : roots.length === 0 ? (
                                        <div className="h-full flex items-center justify-center text-sm text-slate-400">
                                            Keine Inhalte gefunden.
                                        </div>
                                    ) : (
                                        <TreemapCanvas
                                            data={treemapData}
                                            onLeafOpen={(node) => {
                                                const explorerNode = nodeMap.get(node.id);
                                                if (
                                                    explorerNode &&
                                                    isResourceNode(explorerNode)
                                                ) {
                                                    openResource(explorerNode.id);
                                                }
                                            }}
                                            onToggleCompletion={(node, completed) => {
                                                const explorerNode = nodeMap.get(node.id);
                                                if (explorerNode) {
                                                    void persistCompletion(
                                                        explorerNode,
                                                        completed,
                                                    );
                                                }
                                            }}
                                            onExport={(node) => {
                                                const explorerNode = nodeMap.get(node.id);
                                                if (explorerNode) {
                                                    openExportDialog(explorerNode);
                                                }
                                            }}
                                        />
                                    )}
                                </div>
                            )}
                        </div>
                    </section>

                    {isSplitMode && (
                        <button
                            type="button"
                            aria-label="Panels resized handle"
                            onPointerDown={onResizeStart}
                            className="w-2 shrink-0 bg-slate-900 hover:bg-slate-800 border-r border-l border-slate-800 cursor-col-resize flex items-center justify-center"
                        >
                            <GripVertical className="h-4 w-4 text-slate-500" />
                        </button>
                    )}

                    {hasViewerContent && viewerSrc && selectedResource && (
                        <section
                            style={{ width: `${viewerWidthPct}%` }}
                            className={cn(
                                'h-full min-w-0 flex flex-col overflow-hidden',
                                shouldAnimatePanels && 'transition-[width] duration-220 ease-out',
                                viewerWidthPct <= 0.01 && 'pointer-events-none',
                            )}
                        >
                            <div className="h-11 border-b border-slate-800 px-3 flex items-center justify-between gap-2 text-sm">
                                <span className="truncate">{selectedResource.name}</span>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            void window.studySync?.openExternal?.(viewerSrc);
                                        }}
                                        className="text-xs rounded-md border border-slate-700 px-2 py-1 hover:bg-slate-800"
                                    >
                                        Im Browser öffnen
                                    </button>
                                    <button
                                        type="button"
                                        title={
                                            panelMode === 'viewer-only'
                                                ? 'Split View'
                                                : 'PDF fullscreen'
                                        }
                                        onClick={() => {
                                            stopResize();
                                            setPanelMode((prev) =>
                                                prev === 'viewer-only'
                                                    ? 'split'
                                                    : 'viewer-only',
                                            );
                                        }}
                                        className="rounded-md border border-slate-700 p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white"
                                    >
                                        {panelMode === 'viewer-only' ? (
                                            <ArrowRightFromLine className="h-4 w-4" />
                                        ) : (
                                            <ArrowLeftFromLine className="h-4 w-4" />
                                        )}
                                    </button>
                                </div>
                            </div>
                            <iframe
                                key={viewerSrc}
                                src={viewerSrc}
                                title={selectedResource.name}
                                className="h-full w-full bg-white"
                            />
                        </section>
                    )}
                </div>
            </main>

            {exportNode && (
                <ExportDialog
                    nodeName={exportNode.name}
                    exportMode={exportMode}
                    exportError={exportError}
                    onSaveAs={() => void runExport('saveAs')}
                    onShare={() => void runExport('share')}
                    onClose={() => setExportNode(null)}
                />
            )}
        </div>
    );
}
