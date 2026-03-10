import { Dropdown, Label, Radio, RadioGroup, Switch } from '@heroui/react';
import { createFileRoute } from '@tanstack/react-router';
import {
    ArrowDown,
    ArrowUp,
    ArrowUpDown,
    Download,
    ExternalLink,
    GripVertical,
    LayoutGrid,
    List,
    Loader2,
    LogOut,
    Maximize,
    Minimize,
    RefreshCw,
    Settings,
    RotateCcw,
    SlidersHorizontal,
} from 'lucide-react';
import type { FormEvent, PointerEvent as ReactPointerEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { UpdaterState } from '../../shared/updater';
import { TreemapCanvas } from '../app/components/TreemapCanvas';
import {
    buildInitialCompletionMap,
    collectResourceIds,
    flattenNodes,
    getNodeCompletionValue,
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
import { UpdateStatusCard } from './home/UpdateStatusCard';
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

type CompletionSort = 'none' | 'completed-first' | 'completed-last';
type FocusedPanel = 'explorer' | 'viewer';
type LoginSchoolId = 'fhgr' | 'phgr';

const LOGIN_SCHOOLS = new Set<LoginSchoolId>(['fhgr', 'phgr']);

const EXPLORER_VIEW_SETTINGS_STORAGE_KEY =
    'study-desktop-explorer-view-settings';

function isCompletionSort(value: unknown): value is CompletionSort {
    return (
        value === 'none' ||
        value === 'completed-first' ||
        value === 'completed-last'
    );
}

function isLoginSchoolId(value: unknown): value is LoginSchoolId {
    return (
        typeof value === 'string' &&
        LOGIN_SCHOOLS.has(value as LoginSchoolId)
    );
}

function readStoredExplorerViewSettings(): {
    hideCompleted: boolean;
    completionSort: CompletionSort;
} {
    if (typeof window === 'undefined') {
        return { hideCompleted: false, completionSort: 'none' };
    }

    try {
        const raw = localStorage.getItem(EXPLORER_VIEW_SETTINGS_STORAGE_KEY);
        if (!raw) {
            return { hideCompleted: false, completionSort: 'none' };
        }

        const parsed = JSON.parse(raw) as {
            hideCompleted?: unknown;
            completionSort?: unknown;
        };

        return {
            hideCompleted: parsed.hideCompleted === true,
            completionSort: isCompletionSort(parsed.completionSort)
                ? parsed.completionSort
                : 'none',
        };
    } catch (error) {
        console.error('Failed to restore explorer view settings', error);
        return { hideCompleted: false, completionSort: 'none' };
    }
}

function Home() {
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [hideCompleted, setHideCompleted] = useState(
        () => readStoredExplorerViewSettings().hideCompleted,
    );
    const [completionSort, setCompletionSort] = useState<CompletionSort>(
        () => readStoredExplorerViewSettings().completionSort,
    );
    const [apiBase, setApiBase] = useState<string>('');
    const [authStatus, setAuthStatus] = useState<AuthStatusResponse | null>(
        null,
    );
    const [authLoading, setAuthLoading] = useState(true);
    const [authError, setAuthError] = useState<string | null>(null);
    const [loginSchoolId, setLoginSchoolId] = useState<LoginSchoolId>('fhgr');
    const [loginUsername, setLoginUsername] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [loginSubmitting, setLoginSubmitting] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [updaterState, setUpdaterState] = useState<UpdaterState | null>(null);
    const [showStartupUpdateCard, setShowStartupUpdateCard] = useState(false);
    const [isUpdateCardDismissed, setIsUpdateCardDismissed] = useState(false);
    const [updaterActionBusy, setUpdaterActionBusy] = useState<
        'check' | 'download' | 'install' | null
    >(null);

    const [roots, setRoots] = useState<ExplorerNode[]>([]);
    const [treeLoading, setTreeLoading] = useState(false);
    const [syncBusyId, setSyncBusyId] = useState<string | null>(null);
    const [syncAllBusy, setSyncAllBusy] = useState(false);
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
    const explorerHoverPreviewCloseTimeoutRef = useRef<number | null>(null);
    const [isExplorerHoverPreviewOpen, setIsExplorerHoverPreviewOpen] =
        useState(false);
    const [explorerHoverPreviewWidthPx, setExplorerHoverPreviewWidthPx] =
        useState(520);
    const [focusedPanel, setFocusedPanel] = useState<FocusedPanel>('explorer');
    const explorerHoverPreviewResizeSessionRef = useRef<{
        pointerId: number;
        startX: number;
        startWidth: number;
    } | null>(null);
    const isExplorerHoverPreviewResizingRef = useRef(false);
    const updaterCheckOriginRef = useRef<'startup' | 'manual'>('startup');

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

    const [viewerLoading, setViewerLoading] = useState(false);
    useEffect(() => {
        if (viewerSrc) {
            setViewerLoading(true);
        }
    }, [viewerSrc]);
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
    const canShowExplorerHoverPreview =
        hasViewerContent && panelMode === 'viewer-only';
    const showExplorerHoverPreview =
        canShowExplorerHoverPreview && isExplorerHoverPreviewOpen;
    const showExplorerPanelToggle = Boolean(
        selectedResource &&
            (panelMode === 'explorer-only' ||
                (panelMode === 'split' && focusedPanel === 'explorer')),
    );
    const showViewerPanelToggle =
        panelMode === 'viewer-only' ||
        (panelMode === 'split' && focusedPanel === 'viewer');

    const clampExplorerHoverPreviewWidth = useCallback(
        (nextWidth: number) => {
            const containerWidth =
                splitContainerRef.current?.getBoundingClientRect().width ??
                window.innerWidth;
            const minWidth = 360;
            const maxWidth = Math.max(minWidth, Math.min(920, containerWidth - 32));
            return Math.round(Math.min(maxWidth, Math.max(minWidth, nextWidth)));
        },
        [splitContainerRef],
    );

    const openResource = useCallback(
        (resourceId: string) => {
            setSelectedResourceId(resourceId);
            setFocusedPanel('viewer');
            setPanelMode((prev) => (prev === 'explorer-only' ? 'split' : prev));
        },
        [setPanelMode],
    );

    useEffect(() => {
        if (panelMode === 'explorer-only') {
            setFocusedPanel('explorer');
            return;
        }
        if (panelMode === 'viewer-only') {
            setFocusedPanel('viewer');
        }
    }, [panelMode]);

    const dismissToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    const clearExplorerHoverPreviewCloseTimeout = useCallback(() => {
        if (explorerHoverPreviewCloseTimeoutRef.current !== null) {
            window.clearTimeout(explorerHoverPreviewCloseTimeoutRef.current);
            explorerHoverPreviewCloseTimeoutRef.current = null;
        }
    }, []);

    const openExplorerHoverPreview = useCallback(() => {
        if (!canShowExplorerHoverPreview) {
            return;
        }
        clearExplorerHoverPreviewCloseTimeout();
        setIsExplorerHoverPreviewOpen(true);
    }, [canShowExplorerHoverPreview, clearExplorerHoverPreviewCloseTimeout]);

    const scheduleExplorerHoverPreviewClose = useCallback(() => {
        if (!canShowExplorerHoverPreview) {
            return;
        }
        if (isExplorerHoverPreviewResizingRef.current) {
            return;
        }
        clearExplorerHoverPreviewCloseTimeout();
        explorerHoverPreviewCloseTimeoutRef.current = window.setTimeout(() => {
            setIsExplorerHoverPreviewOpen(false);
            explorerHoverPreviewCloseTimeoutRef.current = null;
        }, 140);
    }, [canShowExplorerHoverPreview, clearExplorerHoverPreviewCloseTimeout]);

    const stopExplorerHoverPreviewResize = useCallback(() => {
        if (!explorerHoverPreviewResizeSessionRef.current) {
            return;
        }
        explorerHoverPreviewResizeSessionRef.current = null;
        isExplorerHoverPreviewResizingRef.current = false;
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
    }, []);

    const onExplorerHoverPreviewResizeStart = useCallback(
        (event: ReactPointerEvent<HTMLButtonElement>) => {
            if (event.button !== 0 || !canShowExplorerHoverPreview) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            clearExplorerHoverPreviewCloseTimeout();
            setIsExplorerHoverPreviewOpen(true);
            explorerHoverPreviewResizeSessionRef.current = {
                pointerId: event.pointerId,
                startX: event.clientX,
                startWidth: explorerHoverPreviewWidthPx,
            };
            isExplorerHoverPreviewResizingRef.current = true;
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'ew-resize';
        },
        [
            canShowExplorerHoverPreview,
            clearExplorerHoverPreviewCloseTimeout,
            explorerHoverPreviewWidthPx,
        ],
    );

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

    const syncUpdaterOverlayVisibility = useCallback((state: UpdaterState) => {
        if (updaterCheckOriginRef.current !== 'startup') {
            if (state.stage === 'not-available') {
                pushToast('Kein Update verfügbar.', 'success');
            }
            if (
                state.stage === 'not-available' ||
                state.stage === 'error' ||
                state.stage === 'downloaded'
            ) {
                updaterCheckOriginRef.current = 'startup';
            }
            return;
        }

        if (
            state.stage === 'available' ||
            state.stage === 'downloading' ||
            state.stage === 'downloaded'
        ) {
            setShowStartupUpdateCard(true);
            return;
        }

        if (state.stage === 'idle' || state.stage === 'not-available') {
            setShowStartupUpdateCard(false);
        }
    }, [pushToast]);

    useEffect(() => {
        return () => {
            for (const timeoutId of toastTimeoutsRef.current) {
                window.clearTimeout(timeoutId);
            }
            clearExplorerHoverPreviewCloseTimeout();
            stopExplorerHoverPreviewResize();
        };
    }, [clearExplorerHoverPreviewCloseTimeout, stopExplorerHoverPreviewResize]);

    useEffect(() => {
        if (canShowExplorerHoverPreview) {
            return;
        }
        clearExplorerHoverPreviewCloseTimeout();
        setIsExplorerHoverPreviewOpen(false);
        stopExplorerHoverPreviewResize();
    }, [
        canShowExplorerHoverPreview,
        clearExplorerHoverPreviewCloseTimeout,
        stopExplorerHoverPreviewResize,
    ]);

    useEffect(() => {
        const onPointerMove = (event: PointerEvent) => {
            const session = explorerHoverPreviewResizeSessionRef.current;
            if (!session) {
                return;
            }
            if (event.pointerId !== session.pointerId) {
                return;
            }

            const deltaX = event.clientX - session.startX;
            setExplorerHoverPreviewWidthPx(
                clampExplorerHoverPreviewWidth(session.startWidth + deltaX),
            );
        };

        const onPointerUp = (event: PointerEvent) => {
            const session = explorerHoverPreviewResizeSessionRef.current;
            if (!session || event.pointerId !== session.pointerId) {
                return;
            }
            stopExplorerHoverPreviewResize();
        };

        const onPointerCancel = (event: PointerEvent) => {
            const session = explorerHoverPreviewResizeSessionRef.current;
            if (!session || event.pointerId !== session.pointerId) {
                return;
            }
            stopExplorerHoverPreviewResize();
        };

        const onBlur = () => {
            stopExplorerHoverPreviewResize();
        };

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
        window.addEventListener('pointercancel', onPointerCancel);
        window.addEventListener('blur', onBlur);
        return () => {
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
            window.removeEventListener('pointercancel', onPointerCancel);
            window.removeEventListener('blur', onBlur);
        };
    }, [clampExplorerHoverPreviewWidth, stopExplorerHoverPreviewResize]);

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
            if (isLoginSchoolId(status.selectedSchool)) {
                setLoginSchoolId(status.selectedSchool);
            }
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
                const dec = JSON.parse(atob(stored)) as {
                    username?: unknown;
                    password?: unknown;
                    schoolId?: unknown;
                };
                if (dec.username && dec.password) {
                    setLoginUsername(String(dec.username));
                    setLoginPassword(String(dec.password));
                    if (isLoginSchoolId(dec.schoolId)) {
                        setLoginSchoolId(dec.schoolId);
                    }
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
        let disposed = false;
        let unsubscribe: (() => void) | undefined;

        const loadUpdaterState = async () => {
            try {
                const state = await window.studySync?.updaterGetState?.();
                if (!disposed && state) {
                    setUpdaterState(state);
                    syncUpdaterOverlayVisibility(state);
                }
            } catch {
                // noop
            }
        };

        void loadUpdaterState();

        unsubscribe = window.studySync?.onUpdaterStateChange?.((state) => {
            if (disposed) {
                return;
            }
            setUpdaterState(state);
            syncUpdaterOverlayVisibility(state);
            if (
                state.stage !== 'checking' &&
                state.stage !== 'available' &&
                state.stage !== 'downloading'
            ) {
                setUpdaterActionBusy(null);
            }
        });

        return () => {
            disposed = true;
            unsubscribe?.();
        };
    }, [syncUpdaterOverlayVisibility]);

    useEffect(() => {
        try {
            localStorage.setItem(
                EXPLORER_VIEW_SETTINGS_STORAGE_KEY,
                JSON.stringify({
                    hideCompleted,
                    completionSort,
                }),
            );
        } catch (error) {
            console.error('Failed to save explorer view settings', error);
        }
    }, [hideCompleted, completionSort]);

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
                    schoolId: loginSchoolId,
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
                selectedSchool: payload.schoolId ?? loginSchoolId,
                hasStoredCredentials: true,
            }));

            if (rememberMe) {
                try {
                    const enc = btoa(
                        JSON.stringify({
                            schoolId: loginSchoolId,
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

    const refreshSemesterNode = useCallback(
        async (node: ExplorerNode) => {
            if (!apiBase) {
                return;
            }

            setSyncBusyId(node.id);
            try {
                const response = await fetch(
                    `${apiBase}/nodes/${encodeURIComponent(node.id)}/refresh`,
                    { method: 'POST' },
                );
                if (!response.ok) {
                    const payload = await readJson<{ error?: string }>(response);
                    throw new Error(
                        payload.error ||
                            `Semester-Sync fehlgeschlagen (${response.status})`,
                    );
                }

                await loadTree();
                pushToast(`Semester ${node.name} synchronisiert.`, 'success');
            } catch (error) {
                pushToast(
                    error instanceof Error
                        ? error.message
                        : 'Semester konnte nicht synchronisiert werden.',
                    'error',
                );
            } finally {
                setSyncBusyId(null);
            }
        },
        [apiBase, loadTree, pushToast],
    );
    const refreshAllSemesters = useCallback(async () => {
        if (!apiBase) {
            return;
        }

        const semesterRoots = roots.filter((node) => node.type === 'folder');
        if (semesterRoots.length === 0) {
            pushToast('Keine Semester zum Synchronisieren gefunden.', 'error');
            return;
        }

        setSyncAllBusy(true);
        try {
            let syncedCount = 0;
            const failedSemesters: string[] = [];

            for (const node of semesterRoots) {
                const response = await fetch(
                    `${apiBase}/nodes/${encodeURIComponent(node.id)}/refresh`,
                    { method: 'POST' },
                );
                if (response.ok) {
                    syncedCount += 1;
                } else {
                    failedSemesters.push(node.name);
                }
            }

            await loadTree();

            if (failedSemesters.length === 0) {
                pushToast(
                    `${syncedCount} Semester synchronisiert.`,
                    'success',
                );
            } else {
                const preview = failedSemesters.slice(0, 2).join(', ');
                const suffix = failedSemesters.length > 2 ? ', ...' : '';
                pushToast(
                    `${syncedCount}/${semesterRoots.length} Semester synchronisiert. Fehler: ${preview}${suffix}`,
                    'error',
                );
            }
        } catch (error) {
            pushToast(
                error instanceof Error
                    ? error.message
                    : 'Semester konnten nicht synchronisiert werden.',
                'error',
            );
        } finally {
            setSyncAllBusy(false);
        }
    }, [apiBase, loadTree, pushToast, roots]);

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
        value: CompletionSort;
        label: string;
        icon: typeof ArrowUpDown;
    }> = [
        {
            value: 'none',
            label: 'Neutral',
            icon: ArrowUpDown,
        },
        {
            value: 'completed-last',
            label: 'Done last',
            icon: ArrowDown,
        },
        {
            value: 'completed-first',
            label: 'Done first',
            icon: ArrowUp,
        },
    ];
    const activeCompletionSortOption =
        completionSortOptions.find((option) => option.value === completionSort) ??
        completionSortOptions[0];
    const canSyncAllSemesters = Boolean(
        authStatus?.authenticated &&
            !treeLoading &&
            !syncBusyId &&
            !syncAllBusy &&
            roots.some((node) => node.type === 'folder'),
    );
    const triggerUpdateCheck = useCallback(async () => {
        updaterCheckOriginRef.current = 'manual';
        setUpdaterActionBusy('check');
        try {
            const result = await window.studySync?.updaterCheckForUpdates?.();
            if (result && !result.ok) {
                pushToast(
                    result.error || 'Update-Prüfung fehlgeschlagen.',
                    'error',
                );
            }
        } catch {
            pushToast('Update-Prüfung fehlgeschlagen.', 'error');
        } finally {
            setUpdaterActionBusy(null);
        }
    }, [pushToast]);

    const triggerUpdateDownload = useCallback(async () => {
        setUpdaterActionBusy('download');
        try {
            const result = await window.studySync?.updaterDownloadUpdate?.();
            if (result && !result.ok) {
                pushToast(
                    result.error || 'Update-Download fehlgeschlagen.',
                    'error',
                );
                setUpdaterActionBusy(null);
            }
        } catch {
            pushToast('Update-Download fehlgeschlagen.', 'error');
            setUpdaterActionBusy(null);
        }
    }, [pushToast]);

    const triggerUpdateInstall = useCallback(async () => {
        setUpdaterActionBusy('install');
        try {
            const result = await window.studySync?.updaterQuitAndInstall?.();
            if (result && !result.ok) {
                const message =
                    result.error === 'APP_NOT_IN_APPLICATIONS'
                        ? 'Auto-Update funktioniert nur, wenn die App im Programme-Ordner liegt.'
                        : result.error === 'UPDATE_ALREADY_INSTALLED'
                          ? 'Die geladene Version ist bereits installiert.'
                          : result.error || 'Update konnte nicht gestartet werden.';
                pushToast(
                    message,
                    'error',
                );
                setUpdaterActionBusy(null);
            }
        } catch {
            pushToast('Update konnte nicht gestartet werden.', 'error');
            setUpdaterActionBusy(null);
        }
    }, [pushToast]);

    const canDownloadUpdate = updaterState?.stage === 'available';
    const canInstallUpdate = updaterState?.stage === 'downloaded';
    const showUpdateOverlayCard = showStartupUpdateCard && !isUpdateCardDismissed;
    const updateSettingsLabel =
        updaterActionBusy === 'check'
            ? 'Prüfe...'
            : updaterState?.stage === 'checking'
              ? 'Prüfe auf Updates...'
              : 'Check for updates';

    if (authLoading || !apiBase) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-black text-neutral-100">
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
                loginSchoolId={loginSchoolId}
                loginUsername={loginUsername}
                loginPassword={loginPassword}
                loginSubmitting={loginSubmitting}
                rememberMe={rememberMe}
                onSchoolChange={(value) => {
                    if (isLoginSchoolId(value)) {
                        setLoginSchoolId(value);
                    }
                }}
                onUsernameChange={setLoginUsername}
                onPasswordChange={setLoginPassword}
                onRememberMeChange={setRememberMe}
                onSubmit={onLogin}
            />
        );
    }

    return (
        <div className="flex h-dvh max-h-dvh w-dvw max-w-dvw overflow-hidden bg-black text-neutral-100">
            {/* ── Sidenav – vertical tabs ──────────────────────────────── */}
            <nav className="w-16 shrink-0 flex flex-col border-r border-neutral-800 bg-black">
                {/* spacer top */}
                <div className="flex-1" />

                {/* View-mode tabs */}
                <div
                    onPointerEnter={openExplorerHoverPreview}
                    onPointerLeave={scheduleExplorerHoverPreviewClose}
                >
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
                                    ? 'text-neutral-100 before:absolute before:left-0 before:top-2 before:bottom-2 before:w-0.5 before:rounded-full before:bg-blue-400'
                                    : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/40',
                            )}
                        >
                            <Icon className="h-4 w-4" />
                            {label}
                        </button>
                    ))}
                </div>

                <div className="flex-1" />

                {/* Filter / sort menu */}
                <Dropdown>
                    <Dropdown.Trigger>
                        <button
                            title={`Filter & Sortierung • ${activeCompletionSortOption.label}${hideCompleted ? ' • Hide done' : ''}`}
                            className="flex flex-col items-center justify-center gap-1 py-3 w-full text-[10px] font-medium text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/40 transition-all select-none"
                        >
                            <SlidersHorizontal className="h-4 w-4" />
                            Filter
                        </button>
                    </Dropdown.Trigger>
                    <Dropdown.Popover
                        placement="top start"
                        className="min-w-[340px]"
                    >
                        <div className="rounded-2xl border border-neutral-800/90 bg-neutral-950/95 p-2.5 shadow-2xl backdrop-blur-md">
                            <Switch
                                isSelected={hideCompleted}
                                onChange={setHideCompleted}
                                className="flex w-full items-center justify-between gap-3 rounded-xl px-2.5 py-2 hover:bg-neutral-900/50"
                            >
                                <Switch.Content className="flex-1">
                                    <Label className="text-sm text-neutral-100">
                                        Hide done
                                    </Label>
                                </Switch.Content>
                                <Switch.Control className="shrink-0">
                                    <Switch.Thumb />
                                </Switch.Control>
                            </Switch>

                            <div className="my-1.5 h-px bg-neutral-800" />

                            <RadioGroup
                                name="completion-sort"
                                value={completionSort}
                                onChange={(value) =>
                                    setCompletionSort(
                                        value as
                                            CompletionSort,
                                    )
                                }
                                className="gap-1"
                            >
                                {completionSortOptions.map((option) => {
                                    const Icon = option.icon;
                                    return (
                                        <Radio
                                            key={option.value}
                                            value={option.value}
                                            className="my-0 rounded-xl border border-transparent px-2.5 py-2 hover:bg-neutral-900/50 data-[selected=true]:bg-neutral-900/70"
                                        >
                                            <Radio.Control className="mt-0.5">
                                                <Radio.Indicator />
                                            </Radio.Control>
                                            <Radio.Content className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <Icon className="h-4 w-4 text-neutral-400" />
                                                    <Label className="text-sm text-neutral-100">
                                                        {option.label}
                                                    </Label>
                                                </div>
                                            </Radio.Content>
                                        </Radio>
                                    );
                                })}
                            </RadioGroup>
                        </div>
                    </Dropdown.Popover>
                </Dropdown>

                {/* Settings menu */}
                <Dropdown>
                    <Dropdown.Trigger>
                        <button
                            title="Settings"
                            className="flex flex-col items-center justify-center gap-1 py-3 w-full text-[10px] font-medium text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/40 transition-all select-none"
                        >
                            <Settings className="h-4 w-4" />
                            Settings
                        </button>
                    </Dropdown.Trigger>
                    <Dropdown.Popover placement="top start" className="min-w-[280px]">
                        <div className="rounded-2xl border border-neutral-800/90 bg-neutral-950/95 p-2.5 shadow-2xl backdrop-blur-md">
                            <div className="px-2.5 pb-2">
                                <div className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">
                                    Updates
                                </div>
                                <div className="mt-1 text-xs text-neutral-400">
                                    {updaterState?.latestVersion &&
                                    (updaterState.stage === 'available' ||
                                        updaterState.stage === 'downloading' ||
                                        updaterState.stage === 'downloaded')
                                        ? `v${updaterState.currentVersion} -> v${updaterState.latestVersion}`
                                        : `Installiert: v${updaterState?.currentVersion ?? '—'}`}
                                </div>
                            </div>

                            <div className="space-y-1">
                                <button
                                    type="button"
                                    onClick={() => void triggerUpdateCheck()}
                                    disabled={updaterActionBusy === 'check'}
                                    className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-sm text-neutral-100 hover:bg-neutral-900/60 disabled:opacity-50"
                                >
                                    <RefreshCw
                                        className={cn(
                                            'h-4 w-4 text-neutral-400',
                                            updaterActionBusy === 'check' &&
                                                'animate-spin',
                                        )}
                                    />
                                    <span>{updateSettingsLabel}</span>
                                </button>

                                {canDownloadUpdate && (
                                    <button
                                        type="button"
                                        onClick={() => void triggerUpdateDownload()}
                                        disabled={updaterActionBusy === 'download'}
                                        className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-sm text-blue-100 hover:bg-blue-950/40 disabled:opacity-50"
                                    >
                                        <Download className="h-4 w-4 text-blue-300" />
                                        <span>
                                            {updaterActionBusy === 'download'
                                                ? 'Lade Update...'
                                                : 'Download update'}
                                        </span>
                                    </button>
                                )}

                                {canInstallUpdate && (
                                    <button
                                        type="button"
                                        onClick={() => void triggerUpdateInstall()}
                                        disabled={updaterActionBusy === 'install'}
                                        className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-sm text-emerald-100 hover:bg-emerald-950/40 disabled:opacity-50"
                                    >
                                        <RotateCcw className="h-4 w-4 text-emerald-300" />
                                        <span>
                                            {updaterActionBusy === 'install'
                                                ? 'Starte neu...'
                                                : 'Restart & update'}
                                        </span>
                                    </button>
                                )}
                            </div>

                            <div className="my-1.5 h-px bg-neutral-800" />

                            <button
                                type="button"
                                onClick={() => void refreshAllSemesters()}
                                disabled={!canSyncAllSemesters}
                                className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-sm text-neutral-100 hover:bg-neutral-900/60 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <RefreshCw
                                    className={cn(
                                        'h-4 w-4 text-neutral-400',
                                        syncAllBusy && 'animate-spin',
                                    )}
                                />
                                <span>
                                    {syncAllBusy
                                        ? 'Synchronisiere alle Semester...'
                                        : 'Alle Semester synchronisieren'}
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => void onLogout()}
                                className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-sm text-neutral-100 hover:bg-neutral-900/60 hover:text-red-300"
                            >
                                <LogOut className="h-4 w-4 text-neutral-400" />
                                <span>Logout</span>
                            </button>
                        </div>
                    </Dropdown.Popover>
                </Dropdown>
            </nav>

            {/* ── Main content ─────────────────────────────────────────── */}
            <main className="flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col">
                <div
                    ref={splitContainerRef}
                    className="relative flex-1 min-h-0 w-full flex min-w-0"
                >
                    {/* ── Explorer panel ──────────────────────────────── */}
                    <section
                        style={
                            canShowExplorerHoverPreview
                                ? {
                                      width: `${clampExplorerHoverPreviewWidth(explorerHoverPreviewWidthPx)}px`,
                                  }
                                : { width: `${explorerWidthPct}%` }
                        }
                        onPointerDown={() => setFocusedPanel('explorer')}
                        onPointerEnter={
                            canShowExplorerHoverPreview
                                ? openExplorerHoverPreview
                                : undefined
                        }
                        onPointerLeave={
                            canShowExplorerHoverPreview
                                ? scheduleExplorerHoverPreviewClose
                                : undefined
                        }
                        className={cn(
                            'min-w-0 flex flex-col overflow-hidden',
                            !canShowExplorerHoverPreview && 'h-full',
                            canShowExplorerHoverPreview &&
                                'absolute left-3 top-3 bottom-3 z-20 rounded-2xl border border-neutral-700/80 bg-neutral-950/95 backdrop-blur-xl shadow-[0_18px_50px_rgba(0,0,0,0.45)] transition-[transform,opacity] duration-200 ease-out',
                            canShowExplorerHoverPreview &&
                                (showExplorerHoverPreview
                                    ? 'translate-x-0 opacity-100 pointer-events-auto'
                                    : '-translate-x-3 opacity-0 pointer-events-none'),
                            shouldAnimatePanels &&
                                !canShowExplorerHoverPreview &&
                                'transition-[width] duration-220 ease-out',
                            hasViewerContent &&
                                explorerWidthPct > 0 &&
                                'border-r border-neutral-800',
                            explorerWidthPct <= 0.01 &&
                                !canShowExplorerHoverPreview &&
                                'pointer-events-none',
                        )}
                    >
                        {/* Explorer toolbar */}
                        <div className="h-11 border-b border-neutral-800 px-3 flex items-center justify-between gap-2">
                            <div className="text-sm font-medium text-neutral-200">
                                Explorer
                            </div>
                            <div className="flex items-center gap-1.5">
                                {/* Split toggle */}
                                {showExplorerPanelToggle && (
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
                                        className="w-7 h-7 flex items-center justify-center rounded-full text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-all"
                                    >
                                        {panelMode === 'explorer-only' ? (
                                            <Minimize className="h-4 w-4" />
                                        ) : (
                                            <Maximize className="h-4 w-4" />
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Explorer content */}
                        <div className="flex-1 min-h-0">
                            {viewMode === 'list' ? (
                                <div className="h-full overflow-auto">
                                    <div className="px-3 py-2 text-xs uppercase tracking-wider text-neutral-500">
                                        Semester / Kurse / Wochen / Ressourcen
                                    </div>

                                    {treeLoading ? (
                                        <div className="px-3 py-4 text-sm text-neutral-400 flex items-center gap-2">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Lade Inhalte...
                                        </div>
                                    ) : sortedRoots.length === 0 ? (
                                        <div className="px-3 py-4 text-sm text-neutral-400">
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
                                                syncBusyId={syncBusyId}
                                                syncAllBusy={syncAllBusy}
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
                                                onSyncNode={(node) => {
                                                    void refreshSemesterNode(node);
                                                }}
                                            />
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="h-full min-h-[320px]">
                                    {treeLoading ? (
                                        <div className="h-full flex items-center justify-center text-sm text-neutral-400">
                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                            Lade Inhalte...
                                        </div>
                                    ) : sortedRoots.length === 0 ? (
                                        <div className="h-full flex items-center justify-center text-sm text-neutral-400">
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

                        {canShowExplorerHoverPreview && (
                            <button
                                type="button"
                                aria-label="Breite der Explorer-Vorschau ändern"
                                title="Explorer-Vorschau breiter/schmaler ziehen"
                                onPointerDown={onExplorerHoverPreviewResizeStart}
                                className="absolute inset-y-0 right-0 w-3 cursor-ew-resize group"
                            >
                                <span className="absolute inset-y-6 right-1.5 w-px rounded-full bg-neutral-700/70 transition-colors group-hover:bg-blue-400/80 group-active:bg-blue-300" />
                            </button>
                        )}
                    </section>

                    {/* Resize handle */}
                    {isSplitMode && (
                        <button
                            type="button"
                            aria-label="Panels resized handle"
                            onPointerDown={onResizeStart}
                            className="w-1.5 shrink-0 bg-neutral-900 hover:bg-neutral-700 border-r border-l border-neutral-800 cursor-col-resize flex items-center justify-center transition-colors"
                        >
                            <GripVertical className="h-4 w-4 text-neutral-600" />
                        </button>
                    )}

                    {/* ── PDF Viewer panel ────────────────────────────── */}
                    {hasViewerContent && viewerSrc && selectedResource && (
                        <section
                            style={{ width: `${viewerWidthPct}%` }}
                            onPointerDown={() => setFocusedPanel('viewer')}
                            className={cn(
                                'h-full min-w-0 flex flex-col overflow-hidden',
                                shouldAnimatePanels &&
                                    'transition-[width] duration-220 ease-out',
                                viewerWidthPct <= 0.01 && 'pointer-events-none',
                            )}
                        >
                            {/* PDF toolbar — ghost pill buttons */}
                            <div className="h-11 border-b border-neutral-800 px-3 flex items-center gap-2">
                                {showViewerPanelToggle && (
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
                                        className="w-7 h-7 flex items-center justify-center rounded-full text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-all shrink-0"
                                    >
                                        {panelMode === 'viewer-only' ? (
                                            <Minimize className="h-4 w-4" />
                                        ) : (
                                            <Maximize className="h-4 w-4" />
                                        )}
                                    </button>
                                )}
                                <div className="flex-1" />
                                <span className="max-w-[50%] truncate text-sm text-neutral-200 text-right">
                                    {selectedResource.name}
                                </span>
                                <button
                                    type="button"
                                    title="Im Browser öffnen"
                                    onClick={() => {
                                        void window.studySync?.openExternal?.(
                                            viewerSrc,
                                        );
                                    }}
                                    className="w-7 h-7 flex items-center justify-center rounded-full text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-all"
                                >
                                    <ExternalLink className="h-4 w-4" />
                                </button>
                            </div>
                            <div className="flex-1 relative">
                                {viewerLoading && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm z-10 transition-opacity">
                                        <Loader2 className="h-8 w-8 text-neutral-400 animate-spin mb-4" />
                                        <div className="text-sm text-neutral-400 font-medium">
                                            Lade Dokument...
                                        </div>
                                    </div>
                                )}
                                <iframe
                                    key={viewerSrc}
                                    src={viewerSrc}
                                    title={selectedResource.name}
                                    className="h-full w-full bg-white border-0"
                                    onLoad={() => setViewerLoading(false)}
                                />
                            </div>
                        </section>
                    )}
                </div>
            </main>

            {exportNode && (
                <ExportDialog
                    node={exportNode}
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
            {showUpdateOverlayCard && (
                <UpdateStatusCard
                    state={updaterState}
                    actionBusy={updaterActionBusy}
                    onCheckForUpdates={triggerUpdateCheck}
                    onDownloadUpdate={triggerUpdateDownload}
                    onRestartToUpdate={triggerUpdateInstall}
                    onDismiss={() => setIsUpdateCardDismissed(true)}
                />
            )}
            <ToastStack toasts={toasts} onDismiss={dismissToast} />
        </div>
    );
}
