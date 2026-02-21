import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import {
    COLLAPSE_TO_EXPLORER_THRESHOLD,
    COLLAPSE_TO_VIEWER_THRESHOLD,
    DEFAULT_SPLIT_RATIO,
    MAX_SPLIT_RATIO,
    MIN_SPLIT_RATIO,
    type PanelMode,
} from './types';

interface UseSplitPanelsArgs {
    hasViewerContent: boolean;
    selectedResourceId: string | null;
}

export function useSplitPanels({
    hasViewerContent,
    selectedResourceId,
}: UseSplitPanelsArgs) {
    const [panelMode, setPanelMode] = useState<PanelMode>('explorer-only');
    const [splitRatio, setSplitRatio] = useState(DEFAULT_SPLIT_RATIO);
    const [isResizing, setIsResizing] = useState(false);

    const splitContainerRef = useRef<HTMLDivElement | null>(null);
    const isResizingRef = useRef(false);
    const pointerIdRef = useRef<number | null>(null);
    const resizeHandleRef = useRef<HTMLButtonElement | null>(null);

    const clampSplitRatio = useCallback((value: number) => {
        return Math.min(MAX_SPLIT_RATIO, Math.max(MIN_SPLIT_RATIO, value));
    }, []);

    const stopResize = useCallback(() => {
        if (!isResizingRef.current) {
            return;
        }

        const handle = resizeHandleRef.current;
        const pointerId = pointerIdRef.current;
        if (handle && pointerId !== null) {
            try {
                if (handle.hasPointerCapture(pointerId)) {
                    handle.releasePointerCapture(pointerId);
                }
            } catch {
                // noop
            }
        }

        isResizingRef.current = false;
        pointerIdRef.current = null;
        resizeHandleRef.current = null;
        setIsResizing(false);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
    }, []);

    const applySplitFromPointer = useCallback(
        (clientX: number) => {
            const rect = splitContainerRef.current?.getBoundingClientRect();
            if (!rect || rect.width <= 0 || !selectedResourceId) {
                return;
            }

            const rawRatio = (clientX - rect.left) / rect.width;

            if (rawRatio <= COLLAPSE_TO_VIEWER_THRESHOLD) {
                setPanelMode('viewer-only');
                return;
            }
            if (rawRatio >= COLLAPSE_TO_EXPLORER_THRESHOLD) {
                setPanelMode('explorer-only');
                return;
            }

            setPanelMode('split');
            setSplitRatio(clampSplitRatio(rawRatio));
        },
        [clampSplitRatio, selectedResourceId],
    );

    const onResizeStart = useCallback(
        (event: ReactPointerEvent<HTMLButtonElement>) => {
            if (event.button !== 0) {
                return;
            }
            event.preventDefault();
            pointerIdRef.current = event.pointerId;
            resizeHandleRef.current = event.currentTarget;

            try {
                event.currentTarget.setPointerCapture(event.pointerId);
            } catch {
                // noop
            }

            isResizingRef.current = true;
            setIsResizing(true);
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'col-resize';
        },
        [],
    );

    useEffect(() => {
        const onPointerMove = (event: PointerEvent) => {
            if (!isResizingRef.current) {
                return;
            }
            applySplitFromPointer(event.clientX);
        };

        const onPointerUp = (event: PointerEvent) => {
            if (pointerIdRef.current === null || event.pointerId === pointerIdRef.current) {
                stopResize();
            }
        };
        const onPointerCancel = (event: PointerEvent) => {
            if (pointerIdRef.current === null || event.pointerId === pointerIdRef.current) {
                stopResize();
            }
        };
        const onWindowBlur = () => stopResize();

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
        window.addEventListener('pointercancel', onPointerCancel);
        window.addEventListener('blur', onWindowBlur);
        return () => {
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
            window.removeEventListener('pointercancel', onPointerCancel);
            window.removeEventListener('blur', onWindowBlur);
            stopResize();
        };
    }, [applySplitFromPointer, stopResize]);

    useEffect(() => {
        if (!selectedResourceId && panelMode !== 'explorer-only') {
            setPanelMode('explorer-only');
            stopResize();
        }
    }, [panelMode, selectedResourceId, stopResize]);

    const effectivePanelMode: PanelMode = hasViewerContent
        ? panelMode
        : 'explorer-only';
    const isSplitMode = hasViewerContent && effectivePanelMode === 'split';
    const explorerWidthPct =
        effectivePanelMode === 'viewer-only'
            ? 0
            : effectivePanelMode === 'split'
              ? splitRatio * 100
              : 100;
    const viewerWidthPct = hasViewerContent
        ? effectivePanelMode === 'explorer-only'
            ? 0
            : effectivePanelMode === 'split'
              ? (1 - splitRatio) * 100
              : 100
        : 0;
    const shouldAnimatePanels = hasViewerContent && !isResizing;

    return {
        panelMode,
        setPanelMode,
        splitContainerRef,
        isSplitMode,
        explorerWidthPct,
        viewerWidthPct,
        shouldAnimatePanels,
        onResizeStart,
        stopResize,
    };
}
