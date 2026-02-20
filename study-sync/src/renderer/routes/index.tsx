import { createFileRoute } from '@tanstack/react-router';
import {
    Check,
    ChevronDown,
    ChevronRight,
    FileText,
    Folder,
    Loader2,
    Share2,
    Upload,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from '../app/components/ui/context-menu';
import {
    buildInitialCompletionMap,
    collectResourceIds,
    flattenNodes,
    getNodeCompletionValue,
    isFolderNode,
    isResourceNode,
    type ExplorerNode,
} from '../app/treeUtils';
import { cn } from '../shared/lib/utils';

interface AuthStatusResponse {
    authenticated: boolean;
    error?: string | null;
    selectedSchool?: string | null;
    hasStoredCredentials?: boolean;
}

interface LoginResponse {
    ok?: boolean;
    authenticated?: boolean;
    error?: string;
}

type ExportMode = 'saveAs' | 'share';

export const Route = createFileRoute('/')({
    component: Home,
});

function getFallbackApiBase(): string {
    const fromEnv = import.meta.env.VITE_API_BASE;
    if (fromEnv && fromEnv.trim()) {
        return fromEnv.replace(/\/$/, '');
    }
    if (window.location.protocol === 'file:') {
        return 'http://127.0.0.1:3333/api';
    }
    return '/api';
}

async function resolveApiBase(): Promise<string> {
    const fallback = getFallbackApiBase();
    try {
        const dynamicBase = await window.studySync?.getApiBase?.();
        if (dynamicBase && dynamicBase.trim()) {
            return dynamicBase.replace(/\/$/, '');
        }
    } catch {
        // fallback to static value
    }
    return fallback;
}

async function readJson<T>(response: Response): Promise<T> {
    const text = await response.text();
    if (!text.trim()) {
        return {} as T;
    }
    return JSON.parse(text) as T;
}

function Home() {
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

    const viewerSrc = selectedResource
        ? `${apiBase}/nodes/${encodeURIComponent(selectedResource.id)}/data`
        : null;

    const findFirstResource = useCallback((nodes: ExplorerNode[]): ExplorerNode | null => {
        for (const node of nodes) {
            if (isResourceNode(node)) {
                return node;
            }
            const childMatch = findFirstResource(node.children ?? []);
            if (childMatch) {
                return childMatch;
            }
        }
        return null;
    }, []);

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

            const defaultResource = findFirstResource(tree);
            setSelectedResourceId((prev) => prev ?? defaultResource?.id ?? null);
        } catch (error) {
            setTreeError(
                error instanceof Error
                    ? error.message
                    : 'Kursstruktur konnte nicht geladen werden.',
            );
        } finally {
            setTreeLoading(false);
        }
    }, [apiBase, findFirstResource]);

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

                setNotice(
                    `Export gespeichert: ${result.fileCount ?? 0} Datei(en)`,
                );
            } else {
                const result = await window.studySync?.exportShare?.(exportNode.id);
                if (!result) {
                    throw new Error('EXPORT_BRIDGE_UNAVAILABLE');
                }
                if (!result.ok) {
                    throw new Error(result.error || 'EXPORT_SHARE_FAILED');
                }
                setNotice(
                    `Share-ZIP erstellt: ${result.fileCount ?? 0} Datei(en)`,
                );
            }

            setExportNode(null);
        } catch (error) {
            setExportError(
                error instanceof Error
                    ? error.message
                    : 'Export fehlgeschlagen.',
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
            <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
                <form
                    className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/80 p-6 space-y-4"
                    onSubmit={onLogin}
                >
                    <div>
                        <h1 className="text-xl font-semibold text-slate-100">
                            Moodle Login
                        </h1>
                        <p className="mt-1 text-sm text-slate-400">
                            Ohne validen Login ist die App gesperrt.
                        </p>
                    </div>

                    <label className="block text-sm text-slate-300">
                        Username
                        <input
                            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-sky-500"
                            autoComplete="username"
                            value={loginUsername}
                            onChange={(event) => setLoginUsername(event.target.value)}
                            placeholder="moodle username"
                        />
                    </label>

                    <label className="block text-sm text-slate-300">
                        Passwort
                        <input
                            type="password"
                            autoComplete="current-password"
                            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-sky-500"
                            value={loginPassword}
                            onChange={(event) => setLoginPassword(event.target.value)}
                            placeholder="moodle password"
                        />
                    </label>

                    {(authError || authStatus?.error) && (
                        <p className="text-sm text-rose-400">
                            {authError || authStatus.error}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={loginSubmitting}
                        className="w-full rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {loginSubmitting ? 'Prüfe Credentials...' : 'Einloggen'}
                    </button>
                </form>
            </div>
        );
    }

    const renderNode = (node: ExplorerNode, depth: number): ReactNode => {
        const folder = isFolderNode(node);
        const completed = getNodeCompletionValue(node, completionMap);
        const selected = selectedResourceId === node.id;
        const expanded = expandedIds.has(node.id);
        const hasChildren = (node.children?.length ?? 0) > 0;
        const isBusy = completionBusyId === node.id;

        const completionLabel = folder
            ? completed
                ? 'Alle Ressourcen als unerledigt markieren'
                : 'Alle Ressourcen als erledigt markieren'
            : completed
              ? 'Als unerledigt markieren'
              : 'Als erledigt markieren';

        const completionTarget = !completed;

        return (
            <div key={node.id}>
                <ContextMenu>
                    <ContextMenuTrigger asChild>
                        <button
                            type="button"
                            onClick={() => {
                                if (folder) {
                                    toggleExpanded(node.id);
                                } else {
                                    setSelectedResourceId(node.id);
                                }
                            }}
                            className={cn(
                                'w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                                selected
                                    ? 'bg-sky-900/40 text-sky-200'
                                    : 'text-slate-200 hover:bg-slate-800/80',
                            )}
                            style={{ paddingLeft: `${depth * 14 + 8}px` }}
                        >
                            {folder ? (
                                hasChildren ? (
                                    expanded ? (
                                        <ChevronDown className="h-4 w-4 text-slate-400" />
                                    ) : (
                                        <ChevronRight className="h-4 w-4 text-slate-400" />
                                    )
                                ) : (
                                    <span className="w-4" />
                                )
                            ) : (
                                <span className="w-4" />
                            )}

                            {folder ? (
                                <Folder className="h-4 w-4 text-amber-300" />
                            ) : (
                                <FileText className="h-4 w-4 text-sky-300" />
                            )}

                            <span className="truncate flex-1">{node.name}</span>

                            {isBusy ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
                            ) : completed ? (
                                <Check className="h-3.5 w-3.5 text-emerald-400" />
                            ) : null}
                        </button>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="bg-slate-900 border-slate-700 text-slate-100">
                        <ContextMenuItem
                            onClick={() => {
                                void persistCompletion(node, completionTarget);
                            }}
                            className="focus:bg-slate-800 focus:text-white"
                        >
                            <Check className="mr-2 h-4 w-4" />
                            {completionLabel}
                        </ContextMenuItem>
                        <ContextMenuSeparator className="bg-slate-700" />
                        <ContextMenuItem
                            onClick={() => openExportDialog(node)}
                            className="focus:bg-slate-800 focus:text-white"
                        >
                            <Upload className="mr-2 h-4 w-4" />
                            Exportieren...
                        </ContextMenuItem>
                    </ContextMenuContent>
                </ContextMenu>

                {folder && expanded && hasChildren && (
                    <div>{node.children?.map((child) => renderNode(child, depth + 1))}</div>
                )}
            </div>
        );
    };

    return (
        <div className="h-screen flex flex-col bg-slate-950 text-slate-100">
            <header className="h-12 border-b border-slate-800 flex items-center justify-between px-4">
                <div className="text-sm font-medium tracking-wide">
                    Study Desktop
                </div>
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

            <main className="flex-1 min-h-0 flex flex-col md:flex-row">
                <aside className="w-full md:w-[380px] border-b md:border-b-0 md:border-r border-slate-800 overflow-auto">
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
                        <div className="px-2 pb-3">{roots.map((node) => renderNode(node, 0))}</div>
                    )}
                </aside>

                <section className="flex-1 min-h-0">
                    {viewerSrc && selectedResource ? (
                        <div className="h-full flex flex-col">
                            <div className="h-11 border-b border-slate-800 px-3 flex items-center justify-between text-sm">
                                <span className="truncate">{selectedResource.name}</span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        void window.studySync?.openExternal?.(viewerSrc);
                                    }}
                                    className="text-xs rounded-md border border-slate-700 px-2 py-1 hover:bg-slate-800"
                                >
                                    Im Browser öffnen
                                </button>
                            </div>
                            <iframe
                                key={viewerSrc}
                                src={viewerSrc}
                                title={selectedResource.name}
                                className="h-full w-full bg-white"
                            />
                        </div>
                    ) : (
                        <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                            Wähle eine Ressource aus, um die PDF anzuzeigen.
                        </div>
                    )}
                </section>
            </main>

            {exportNode && (
                <div className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center px-4">
                    <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 p-5">
                        <h2 className="text-lg font-semibold">Exportieren</h2>
                        <p className="mt-1 text-sm text-slate-400">
                            {exportNode.name}
                        </p>

                        {exportError && (
                            <p className="mt-3 text-sm text-rose-400">{exportError}</p>
                        )}

                        <div className="mt-4 space-y-2">
                            <button
                                type="button"
                                disabled={exportMode !== null}
                                onClick={() => void runExport('saveAs')}
                                className="w-full rounded-lg border border-slate-700 px-3 py-2 text-sm text-left hover:bg-slate-800 disabled:opacity-60"
                            >
                                <div className="font-medium">Save As</div>
                                <div className="text-xs text-slate-400">
                                    Ungezippt in ausgewählten Zielordner exportieren
                                </div>
                            </button>

                            <button
                                type="button"
                                disabled={exportMode !== null}
                                onClick={() => void runExport('share')}
                                className="w-full rounded-lg border border-slate-700 px-3 py-2 text-sm text-left hover:bg-slate-800 disabled:opacity-60"
                            >
                                <div className="font-medium flex items-center gap-2">
                                    <Share2 className="h-4 w-4" />
                                    Share
                                </div>
                                <div className="text-xs text-slate-400">
                                    ZIP erstellen und macOS Share-Dialog öffnen
                                </div>
                            </button>
                        </div>

                        <div className="mt-4 flex justify-end">
                            <button
                                type="button"
                                disabled={exportMode !== null}
                                onClick={() => setExportNode(null)}
                                className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-800 disabled:opacity-60"
                            >
                                Schließen
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
