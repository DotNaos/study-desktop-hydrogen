import { Dropdown } from '@heroui/react';
import { createFileRoute } from '@tanstack/react-router';
import {
    ArrowDown,
    ArrowLeftFromLine,
    ArrowRightFromLine,
    ArrowUp,
    ArrowUpDown,
    ExternalLink,
    GripVertical,
    LayoutGrid,
    List,
    Loader2,
    LogOut,
} from 'lucide-react';
import type { FormEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TreemapCanvas } from '../app/components/TreemapCanvas';
import { Checkbox } from '../app/components/ui/checkbox';
import {
    buildInitialCompletionMap,
    collectResourceIds,
    flattenNodes,
    getNodeCompletionValue,
    isFolderNode,
    isResourceNode,
    type ExplorerNode,
} from '../app/treeUtils';
import { transformCoursesToZoomData } from '../app/zoomData';
import { cn } from '../shared/lib/utils';
import { readJson, resolveApiBase } from './home/api';
import { ExplorerTree } from './home/ExplorerTree';
import { ExportDialog } from './home/ExportDialog';
import { LoginGate } from './home/LoginGate';
import { ToastStack, type ToastItem } from './home/ToastStack';
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
    const [hideCompleted, setHideCompleted] = useState(false);
    const [completionSort, setCompletionSort] = useState<
        'none' | 'completed-first' | 'completed-last'
    >('none');
    const [apiBase, setApiBase] = useState<string>('');
    const [authStatus, setAuthStatus] = useState<AuthStatusResponse | null>(
        null,
    );
    const [authLoading, setAuthLoading] = useState(true);
    const [authError, setAuthError] = useState<string | null>(null);
    const [loginUsername, setLoginUsername] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [loginSubmitting, setLoginSubmitting] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);

    const [roots, setRoots] = useState<ExplorerNode[]>([]);
    const [treeLoading, setTreeLoading] = useState(false);
    const [completionMap, setCompletionMap] = useState<Map<string, boolean>>(
        () => new Map(),
    );
    const [expandedIds, setExpandedIds] = useState<Set<string>>(
        () => new Set(),
    );
    const [selectedResourceId, setSelectedResourceId] = useState<string | null>(
        null,
    );
    const [completionBusyId, setCompletionBusyId] = useState<string | null>(
        null,
    );

    const [exportNode, setExportNode] = useState<ExplorerNode | null>(null);
    const [exportMode, setExportMode] = useState<ExportMode | null>(null);
    const [exportError, setExportError] = useState<string | null>(null);
    const [goodnotesAvailable, setGoodnotesAvailable] = useState(false);
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const toastTimeoutsRef = useRef<number[]>([]);

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

    const visibleRoots = useMemo(() => {
        if (!hideCompleted) {
            return rootsWithCompletion;
        }

        const filterNodes = (nodes: ExplorerNode[]): ExplorerNode[] => {
            const next: ExplorerNode[] = [];
            for (const node of nodes) {
                if (isResourceNode(node)) {
                    if (!getNodeCompletionValue(node, completionMap)) {
                        next.push(node);
                    }
                    continue;
                }

                const filteredChildren = filterNodes(node.children ?? []);
                if (filteredChildren.length > 0) {
                    next.push({
                        ...node,
                        children: filteredChildren,
                    });
                }
            }
            return next;
        };

        return filterNodes(rootsWithCompletion);
    }, [completionMap, hideCompleted, rootsWithCompletion]);

    const sortedRoots = useMemo(() => {
        if (completionSort === 'none') {
            return visibleRoots;
        }

        const sortNodes = (nodes: ExplorerNode[]): ExplorerNode[] => {
            const nodesWithSortedChildren = nodes.map((node) => ({
                ...node,
                children: node.children
                    ? sortNodes(node.children)
                    : node.children,
            }));

            return [...nodesWithSortedChildren].sort((a, b) => {
                const aCompleted = getNodeCompletionValue(a, completionMap);
                const bCompleted = getNodeCompletionValue(b, completionMap);
                if (aCompleted === bCompleted) {
                    return 0;
                }
                if (completionSort === 'completed-first') {
                    return aCompleted ? -1 : 1;
                }
                return aCompleted ? 1 : -1;
            });
        };

        return sortNodes(visibleRoots);
    }, [completionMap, completionSort, visibleRoots]);

    const treemapData = useMemo(
        () => transformCoursesToZoomData(sortedRoots as any),
        [sortedRoots],
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

    const dismissToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    const pushToast = useCallback(
        (message: string, tone: ToastItem['tone']) => {
            const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
            setToasts((prev) => [...prev, { id, message, tone }]);
            const timeoutId = window.setTimeout(() => {
                dismissToast(id);
            }, 3400);
            toastTimeoutsRef.current.push(timeoutId);
        },
        [dismissToast],
    );

    useEffect(() => {
        return () => {
            for (const timeoutId of toastTimeoutsRef.current) {
                window.clearTimeout(timeoutId);
            }
        };
    }, []);

    const loadTree = useCallback(async () => {
        if (!apiBase) {
            return;
        }

        setTreeLoading(true);
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
            pushToast(
                error instanceof Error
                    ? error.message
                    : 'Kursstruktur konnte nicht geladen werden.',
                'error',
            );
        } finally {
            setTreeLoading(false);
        }
    }, [apiBase, pushToast]);

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

        try {
            const stored = localStorage.getItem('study-desktop-remember-me');
            if (stored) {
                const dec = JSON.parse(atob(stored));
                if (dec.username && dec.password) {
                    setLoginUsername(dec.username);
                    setLoginPassword(dec.password);
                    setRememberMe(true);
                }
            }
        } catch (err) {
            console.error('Failed to restore saved credentials', err);
        }
    }, []);

    useEffect(() => {
        const loadGoodnotesAvailability = async () => {
            try {
                const available =
                    await window.studySync?.isGoodnotesAvailable?.();
                setGoodnotesAvailable(Boolean(available));
            } catch {
                setGoodnotesAvailable(false);
            }
        };
        void loadGoodnotesAvailability();
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

            if (
                !response.ok ||
                !payload.ok ||
                payload.authenticated === false
            ) {
                throw new Error(payload.error || 'LOGIN_FAILED');
            }

            setAuthStatus((prev) => ({
                authenticated: true,
                error: null,
                selectedSchool: prev?.selectedSchool ?? null,
                hasStoredCredentials: true,
            }));

            if (rememberMe) {
                try {
                    const enc = btoa(
                        JSON.stringify({
                            username: loginUsername.trim(),
                            password: loginPassword,
                        }),
                    );
                    localStorage.setItem('study-desktop-remember-me', enc);
                } catch (err) {
                    console.error('Failed to save credentials', err);
                }
            } else {
                localStorage.removeItem('study-desktop-remember-me');
            }

            if (!rememberMe) {
                setLoginPassword('');
            }
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

    const onLogout = useCallback(async () => {
        try {
            const response = await fetch(`${apiBase}/auth/logout`, {
                method: 'POST',
            });
            const payload = await readJson<{ ok?: boolean; error?: string }>(
                response,
            );
            if (!response.ok || !payload.ok) {
                throw new Error(payload.error || 'LOGOUT_FAILED');
            }

            setAuthStatus((prev) => ({
                authenticated: false,
                error: 'AUTH_REQUIRED',
                selectedSchool: prev?.selectedSchool ?? null,
                hasStoredCredentials: prev?.hasStoredCredentials ?? false,
            }));
            setAuthError(null);
            setLoginPassword('');
            localStorage.removeItem('study-desktop-remember-me');
            setRememberMe(false);
            setRoots([]);
            setCompletionMap(new Map());
            setExpandedIds(new Set());
            setSelectedResourceId(null);
            setExportNode(null);
        } catch (error) {
            pushToast(
                error instanceof Error
                    ? error.message
                    : 'Logout fehlgeschlagen.',
                'error',
            );
        }
    }, [apiBase, pushToast]);

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

    const persistCompletion = useCallback(
        async (node: ExplorerNode, completed: boolean): Promise<void> => {
            const ids = collectResourceIds(node);
            if (ids.length === 0) {
                return;
            }

            setCompletionBusyId(node.id);
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
                        throw new Error(
                            `Completion update failed (${response.status})`,
                        );
                    }
                } else {
                    const updates = Object.fromEntries(
                        ids.map((id) => [id, completed]),
                    );
                    const response = await fetch(
                        `${apiBase}/nodes/completion/batch`,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ updates }),
                        },
                    );
                    if (!response.ok) {
                        throw new Error(
                            `Batch completion failed (${response.status})`,
                        );
                    }
                }

                setCompletionMap((prev) => {
                    const next = new Map(prev);
                    for (const id of ids) {
                        next.set(id, completed);
                    }
                    return next;
                });

                pushToast(
                    completed
                        ? `${ids.length} Ressource(n) als erledigt markiert`
                        : `${ids.length} Ressource(n) als unerledigt markiert`,
                    'success',
                );
            } catch (error) {
                pushToast(
                    error instanceof Error
                        ? error.message
                        : 'Completion konnte nicht gespeichert werden.',
                    'error',
                );
            } finally {
                setCompletionBusyId(null);
            }
        },
        [apiBase, pushToast],
    );

    const openExportDialog = (node: ExplorerNode) => {
        setExportNode(node);
        setExportMode(null);
        setExportError(null);
    };

    const runExport = useCallback(
        async (mode: ExportMode) => {
            if (!exportNode) {
                return;
            }
            setExportMode(mode);
            setExportError(null);

            try {
                if (mode === 'saveAs') {
                    const result = await window.studySync?.exportSaveAs?.(
                        exportNode.id,
                    );
                    if (!result) {
                        throw new Error('EXPORT_BRIDGE_UNAVAILABLE');
                    }
                    if (!result.ok) {
                        if (result.cancelled) {
                            setExportNode(null);
                            return;
                        }
                        throw new Error(
                            result.error || 'EXPORT_SAVE_AS_FAILED',
                        );
                    }
                    pushToast(
                        `Export gespeichert: ${result.fileCount ?? 0} Datei(en)`,
                        'success',
                    );
                } else if (mode === 'share') {
                    if (isFolderNode(exportNode)) {
                        throw new Error('SHARE_RESOURCE_ONLY');
                    }
                    const result = await window.studySync?.exportShare?.(
                        exportNode.id,
                    );
                    if (!result) {
                        throw new Error('EXPORT_BRIDGE_UNAVAILABLE');
                    }
                    if (!result.ok) {
                        throw new Error(result.error || 'EXPORT_SHARE_FAILED');
                    }
                    pushToast(
                        `Share-ZIP erstellt: ${result.fileCount ?? 0} Datei(en)`,
                        'success',
                    );
                } else if (mode === 'openWith') {
                    if (isFolderNode(exportNode)) {
                        throw new Error('OPEN_WITH_RESOURCE_ONLY');
                    }
                    const result = await window.studySync?.exportOpenWith?.(
                        exportNode.id,
                    );
                    if (!result) {
                        throw new Error('EXPORT_BRIDGE_UNAVAILABLE');
                    }
                    if (!result.ok) {
                        if (result.cancelled) {
                            setExportNode(null);
                            return;
                        }
                        throw new Error(
                            result.error || 'EXPORT_OPEN_WITH_FAILED',
                        );
                    }
                    pushToast(
                        `Export geöffnet: ${result.fileCount ?? 0} Datei(en)`,
                        'success',
                    );
                } else if (mode === 'openGoodnotes') {
                    if (isFolderNode(exportNode)) {
                        throw new Error('GOODNOTES_RESOURCE_ONLY');
                    }
                    const result =
                        await window.studySync?.exportOpenGoodnotes?.(
                            exportNode.id,
                        );
                    if (!result) {
                        throw new Error('EXPORT_BRIDGE_UNAVAILABLE');
                    }
                    if (!result.ok) {
                        throw new Error(
                            result.error || 'EXPORT_GOODNOTES_FAILED',
                        );
                    }
                    pushToast(
                        `In Goodnotes geöffnet: ${result.fileCount ?? 0} Datei(en)`,
                        'success',
                    );
                }

                setExportNode(null);
            } catch (error) {
                const rawMessage =
                    error instanceof Error
                        ? error.message
                        : 'Export fehlgeschlagen.';
                const message =
                    rawMessage === 'GOODNOTES_RESOURCE_ONLY'
                        ? 'Goodnotes ist nur für einzelne PDF-Ressourcen verfügbar.'
                        : rawMessage === 'OPEN_WITH_RESOURCE_ONLY'
                          ? '"Öffnen mit" ist nur für einzelne Ressourcen verfügbar.'
                          : rawMessage === 'SHARE_RESOURCE_ONLY'
                            ? '"Teilen" ist nur für einzelne Ressourcen verfügbar.'
                            : rawMessage === 'GOODNOTES_NOT_INSTALLED'
                              ? 'Goodnotes ist nicht installiert.'
                              : rawMessage;
                setExportError(message);
                pushToast(message, 'error');
            } finally {
                setExportMode(null);
            }
        },
        [exportNode, pushToast],
    );

    const completionSortOptions: Array<{
        value: 'none' | 'completed-first' | 'completed-last';
        label: string;
        icon: typeof ArrowUpDown;
    }> = [
        { value: 'none', label: 'Neutral', icon: ArrowUpDown },
        { value: 'completed-last', label: 'Done last', icon: ArrowDown },
        { value: 'completed-first', label: 'Done first', icon: ArrowUp },
    ];

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
                rememberMe={rememberMe}
                onUsernameChange={setLoginUsername}
                onPasswordChange={setLoginPassword}
                onRememberMeChange={setRememberMe}
                onSubmit={onLogin}
            />
        );
    }

    return (
        <div className="h-screen flex bg-slate-950 text-slate-100">
            {/* ── Sidenav – vertical tabs ──────────────────────────────── */}
            <nav className="w-16 shrink-0 flex flex-col border-r border-slate-800 bg-slate-950">
                {/* spacer top */}
                <div className="flex-1" />

                {/* View-mode tabs */}
                {(
                    [
                        { key: 'list', Icon: List, label: 'Liste' },
                        { key: 'grid', Icon: LayoutGrid, label: 'Grid' },
                    ] as const
                ).map(({ key, Icon, label }) => (
                    <button
                        key={key}
                        onClick={() => setViewMode(key)}
                        title={label}
                        className={cn(
                            'relative flex flex-col items-center justify-center gap-1 py-3 w-full text-[10px] font-medium transition-all select-none',
                            viewMode === key
                                ? 'text-slate-100 before:absolute before:left-0 before:top-2 before:bottom-2 before:w-0.5 before:rounded-full before:bg-blue-400'
                                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/40',
                        )}
                    >
                        <Icon className="h-4 w-4" />
                        {label}
                    </button>
                ))}

                <div className="flex-1" />

                {/* Logout */}
                <button
                    title="Logout"
                    onClick={() => void onLogout()}
                    className="flex flex-col items-center justify-center gap-1 py-3 w-full text-[10px] font-medium text-slate-500 hover:text-red-400 hover:bg-slate-800/40 transition-all select-none"
                >
                    <LogOut className="h-4 w-4" />
                    Logout
                </button>
            </nav>

            {/* ── Main content ─────────────────────────────────────────── */}
            <main className="flex-1 min-h-0 min-w-0 flex flex-col">
                <div
                    ref={splitContainerRef}
                    className="flex-1 min-h-0 w-full flex min-w-0"
                >
                    {/* ── Explorer panel ──────────────────────────────── */}
                    <section
                        style={{ width: `${explorerWidthPct}%` }}
                        className={cn(
                            'h-full min-w-0 flex flex-col overflow-hidden',
                            shouldAnimatePanels &&
                                'transition-[width] duration-220 ease-out',
                            hasViewerContent &&
                                explorerWidthPct > 0 &&
                                'border-r border-slate-800',
                            explorerWidthPct <= 0.01 && 'pointer-events-none',
                        )}
                    >
                        {/* Explorer toolbar */}
                        <div className="h-11 border-b border-slate-800 px-3 flex items-center justify-between gap-2">
                            <div className="text-sm font-medium text-slate-200">
                                Explorer
                            </div>
                            <div className="flex items-center gap-1.5">
                                {/* Hide completed */}
                                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                    <Checkbox
                                        id="hide-completed"
                                        checked={hideCompleted}
                                        onCheckedChange={(v) =>
                                            setHideCompleted(v === true)
                                        }
                                        className="h-3.5 w-3.5"
                                    />
                                    <span className="text-xs text-slate-400">
                                        Hide done
                                    </span>
                                </label>

                                {/* Sort dropdown */}
                                <Dropdown>
                                    <Dropdown.Trigger>
                                        <button className="h-7 flex items-center gap-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 px-2 rounded-full text-xs transition-all">
                                            {(() => {
                                                const opt =
                                                    completionSortOptions.find(
                                                        (o) =>
                                                            o.value ===
                                                            completionSort,
                                                    )!;
                                                const Icon = opt.icon;
                                                return (
                                                    <>
                                                        <Icon className="h-3.5 w-3.5" />
                                                        {opt.label}
                                                    </>
                                                );
                                            })()}
                                        </button>
                                    </Dropdown.Trigger>
                                    <Dropdown.Popover>
                                        <Dropdown.Menu
                                            aria-label="Sortierung"
                                            selectionMode="single"
                                            selectedKeys={
                                                new Set([completionSort])
                                            }
                                            onSelectionChange={(keys) => {
                                                const key = Array.from(keys)[0];
                                                if (key)
                                                    setCompletionSort(
                                                        key as any,
                                                    );
                                            }}
                                        >
                                            {completionSortOptions.map(
                                                (option) => (
                                                    <Dropdown.Item
                                                        key={option.value}
                                                        id={option.value}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <option.icon className="w-4 h-4 text-slate-400" />
                                                            {option.label}
                                                        </div>
                                                    </Dropdown.Item>
                                                ),
                                            )}
                                        </Dropdown.Menu>
                                    </Dropdown.Popover>
                                </Dropdown>

                                {/* Split toggle */}
                                {selectedResource && (
                                    <button
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
                                        className="w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all"
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

                        {/* Explorer content */}
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
                                    ) : sortedRoots.length === 0 ? (
                                        <div className="px-3 py-4 text-sm text-slate-400">
                                            Keine Inhalte gefunden.
                                        </div>
                                    ) : (
                                        <div className="px-2 pb-3">
                                            <ExplorerTree
                                                roots={sortedRoots}
                                                completionMap={completionMap}
                                                expandedIds={expandedIds}
                                                selectedResourceId={
                                                    selectedResourceId
                                                }
                                                completionBusyId={
                                                    completionBusyId
                                                }
                                                onToggleExpanded={
                                                    toggleExpanded
                                                }
                                                onOpenResource={openResource}
                                                onPersistCompletion={(
                                                    node,
                                                    completed,
                                                ) => {
                                                    void persistCompletion(
                                                        node,
                                                        completed,
                                                    );
                                                }}
                                                onOpenExportDialog={
                                                    openExportDialog
                                                }
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
                                    ) : sortedRoots.length === 0 ? (
                                        <div className="h-full flex items-center justify-center text-sm text-slate-400">
                                            Keine Inhalte gefunden.
                                        </div>
                                    ) : (
                                        <TreemapCanvas
                                            data={treemapData}
                                            onLeafOpen={(node) => {
                                                const explorerNode =
                                                    nodeMap.get(node.id);
                                                if (
                                                    explorerNode &&
                                                    isResourceNode(explorerNode)
                                                ) {
                                                    openResource(
                                                        explorerNode.id,
                                                    );
                                                }
                                            }}
                                            onToggleCompletion={(
                                                node,
                                                completed,
                                            ) => {
                                                const explorerNode =
                                                    nodeMap.get(node.id);
                                                if (explorerNode) {
                                                    void persistCompletion(
                                                        explorerNode,
                                                        completed,
                                                    );
                                                }
                                            }}
                                            onExport={(node) => {
                                                const explorerNode =
                                                    nodeMap.get(node.id);
                                                if (explorerNode) {
                                                    openExportDialog(
                                                        explorerNode,
                                                    );
                                                }
                                            }}
                                        />
                                    )}
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Resize handle */}
                    {isSplitMode && (
                        <button
                            type="button"
                            aria-label="Panels resized handle"
                            onPointerDown={onResizeStart}
                            className="w-1.5 shrink-0 bg-slate-900 hover:bg-slate-700 border-r border-l border-slate-800 cursor-col-resize flex items-center justify-center transition-colors"
                        >
                            <GripVertical className="h-4 w-4 text-slate-600" />
                        </button>
                    )}

                    {/* ── PDF Viewer panel ────────────────────────────── */}
                    {hasViewerContent && viewerSrc && selectedResource && (
                        <section
                            style={{ width: `${viewerWidthPct}%` }}
                            className={cn(
                                'h-full min-w-0 flex flex-col overflow-hidden',
                                shouldAnimatePanels &&
                                    'transition-[width] duration-220 ease-out',
                                viewerWidthPct <= 0.01 && 'pointer-events-none',
                            )}
                        >
                            {/* PDF toolbar — ghost pill buttons */}
                            <div className="h-11 border-b border-slate-800 px-3 flex items-center gap-2">
                                <button
                                    type="button"
                                    title="Im Browser öffnen"
                                    onClick={() => {
                                        void window.studySync?.openExternal?.(
                                            viewerSrc,
                                        );
                                    }}
                                    className="w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all shrink-0"
                                >
                                    <ExternalLink className="h-4 w-4" />
                                </button>
                                <span className="flex-1 truncate text-sm text-slate-200">
                                    {selectedResource.name}
                                </span>
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
                                    className="w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all"
                                >
                                    {panelMode === 'viewer-only' ? (
                                        <ArrowRightFromLine className="h-4 w-4" />
                                    ) : (
                                        <ArrowLeftFromLine className="h-4 w-4" />
                                    )}
                                </button>
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
                    isFolder={isFolderNode(exportNode)}
                    goodnotesAvailable={goodnotesAvailable}
                    exportMode={exportMode}
                    exportError={exportError}
                    onSaveAs={() => void runExport('saveAs')}
                    onShare={() => void runExport('share')}
                    onOpenWith={() => void runExport('openWith')}
                    onOpenGoodnotes={() => void runExport('openGoodnotes')}
                    onClose={() => setExportNode(null)}
                />
            )}
            <ToastStack toasts={toasts} onDismiss={dismissToast} />
        </div>
    );
}
