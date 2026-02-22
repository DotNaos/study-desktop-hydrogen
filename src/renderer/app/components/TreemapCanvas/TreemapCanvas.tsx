import { Check, Home, Layers, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../../../shared/lib/utils';
import type { Node } from '../../zoomData';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
} from '../ui/context-menu';

// Recursive preview grid component with true 1:1 aspect ratio cells
function PreviewGrid({
    children,
    getProgress,
    maxDepth,
    currentDepth = 0,
    showProgressFill = true,
}: {
    children: Node[];
    getProgress: (node: Node) => number;
    maxDepth: number;
    currentDepth?: number;
    showProgressFill?: boolean;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ width: 0, height: 0 });

    useLayoutEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const update = () => {
            const { width, height } = el.getBoundingClientRect();
            setSize({ width, height });
        };
        update();
        const observer = new ResizeObserver(update);
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    // Pre-compute values needed for placeholderPath useMemo (must be before early return)
    const itemCount =
        children.length === 0 || currentDepth >= maxDepth
            ? 0
            : Math.min(children.length, 64);
    const gridSize = Math.ceil(Math.sqrt(itemCount)) || 1;
    const cols = gridSize;
    const rows = gridSize;
    const totalCells = gridSize * gridSize;
    const emptyCount = totalCells - itemCount;
    const baseGap = Math.max(2, 6 - currentDepth * 2);
    const maxCellWidth = (size.width - (cols - 1) * baseGap) / cols;
    const maxCellHeight = (size.height - (rows - 1) * baseGap) / rows;
    const cellSize = Math.max(
        0,
        Math.floor(Math.min(maxCellWidth, maxCellHeight)),
    );
    const borderRadius = Math.max(2, Math.min(6, cellSize * 0.12));

    // Generate SVG path for connected Tetris placeholder shape (must be called before early return)
    const placeholderPath = useMemo(() => {
        if (emptyCount === 0 || itemCount === 0) return null;

        const positions = Array.from({ length: emptyCount }).map((_, i) => {
            const pos = itemCount + i;
            return { row: Math.floor(pos / cols), col: pos % cols };
        });

        const isPlaceholder = (r: number, c: number) =>
            positions.some((p) => p.row === r && p.col === c);

        // Build path by tracing the outline
        const gridW = cellSize + baseGap;
        const gridH = cellSize + baseGap;
        const r = borderRadius;

        // Generate rounded rect segments for each cell, merging edges
        let path = '';
        for (const pos of positions) {
            const x = pos.col * gridW;
            const y = pos.row * gridH;
            const w = cellSize;
            const h = cellSize;

            const hasTop = isPlaceholder(pos.row - 1, pos.col);
            const hasBottom = isPlaceholder(pos.row + 1, pos.col);
            const hasLeft = isPlaceholder(pos.row, pos.col - 1);
            const hasRight = isPlaceholder(pos.row, pos.col + 1);

            // Extend to fill gaps with neighbors
            const extendRight = hasRight ? baseGap : 0;
            const extendBottom = hasBottom ? baseGap : 0;

            const tl = !hasTop && !hasLeft ? r : 0;
            const tr = !hasTop && !hasRight ? r : 0;
            const br = !hasBottom && !hasRight ? r : 0;
            const bl = !hasBottom && !hasLeft ? r : 0;

            path += `M ${x + tl} ${y} `;
            path += `L ${x + w + extendRight - tr} ${y} `;
            if (tr > 0)
                path += `Q ${x + w + extendRight} ${y} ${x + w + extendRight} ${y + tr} `;
            path += `L ${x + w + extendRight} ${y + h + extendBottom - br} `;
            if (br > 0)
                path += `Q ${x + w + extendRight} ${y + h + extendBottom} ${x + w + extendRight - br} ${y + h + extendBottom} `;
            path += `L ${x + bl} ${y + h + extendBottom} `;
            if (bl > 0)
                path += `Q ${x} ${y + h + extendBottom} ${x} ${y + h + extendBottom - bl} `;
            path += `L ${x} ${y + tl} `;
            if (tl > 0) path += `Q ${x} ${y} ${x + tl} ${y} `;
            path += 'Z ';
        }

        const totalW = cols * cellSize + (cols - 1) * baseGap;
        const totalH = rows * cellSize + (rows - 1) * baseGap;

        return { path, totalW, totalH };
    }, [itemCount, emptyCount, cols, rows, cellSize, baseGap, borderRadius]);

    // Early return AFTER all hooks
    if (children.length === 0 || currentDepth >= maxDepth) {
        return <div ref={containerRef} className="w-full h-full" />;
    }

    return (
        <div
            ref={containerRef}
            className="w-full h-full flex items-center justify-center"
        >
            {cellSize > 0 && (
                <div
                    className="grid relative"
                    style={{
                        gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
                        gridTemplateRows: `repeat(${rows}, ${cellSize}px)`,
                        gap: `${baseGap}px`,
                    }}
                >
                    {children.slice(0, 64).map((child) => {
                        const progress = getProgress(child);
                        const isLeaf =
                            !child.children || child.children.length === 0;
                        const grandchildren = child.children ?? [];
                        // Show progress fill only on the deepest visible layer
                        // Either it's a leaf OR we won't recurse further (at maxDepth - 1)
                        const isDeepestLayer =
                            isLeaf || currentDepth >= maxDepth - 1;

                        return (
                            <div
                                key={child.id}
                                className="bg-neutral-700/50 relative overflow-hidden"
                                style={{ borderRadius }}
                            >
                                <div
                                    className="absolute bottom-0 left-0 w-full bg-green-500/70 transition-all"
                                    style={{
                                        height: `${progress}%`,
                                        opacity:
                                            showProgressFill && isDeepestLayer
                                                ? 1
                                                : 0,
                                    }}
                                />
                                {/* Recursive nested preview */}
                                {!isLeaf &&
                                    grandchildren.length > 0 &&
                                    currentDepth < maxDepth - 1 && (
                                        <div
                                            className="absolute overflow-hidden"
                                            style={{
                                                inset: Math.max(1, baseGap / 2),
                                            }}
                                        >
                                            <PreviewGrid
                                                children={grandchildren}
                                                getProgress={getProgress}
                                                maxDepth={maxDepth}
                                                currentDepth={currentDepth + 1}
                                                showProgressFill={
                                                    showProgressFill
                                                }
                                            />
                                        </div>
                                    )}
                            </div>
                        );
                    })}
                    {/* Invisible spacers for grid layout */}
                    {Array.from({ length: emptyCount }).map((_, i) => (
                        <div key={`spacer-${i}`} />
                    ))}
                    {/* Connected Tetris placeholder shape - more muted than normal cells */}
                    {placeholderPath && (
                        <svg
                            className="absolute inset-0 pointer-events-none"
                            width={placeholderPath.totalW}
                            height={placeholderPath.totalH}
                        >
                            <defs>
                                <pattern
                                    id={`stripes-${currentDepth}`}
                                    patternUnits="userSpaceOnUse"
                                    width="8"
                                    height="8"
                                    patternTransform="rotate(-45)"
                                >
                                    <rect
                                        width="8"
                                        height="8"
                                        fill="rgba(60,60,60,0.12)"
                                    />
                                    <rect
                                        width="4"
                                        height="8"
                                        fill="rgba(255,255,255,0.008)"
                                    />
                                </pattern>
                            </defs>
                            <path
                                d={placeholderPath.path}
                                fill={`url(#stripes-${currentDepth})`}
                                fillRule="evenodd"
                            />
                        </svg>
                    )}
                </div>
            )}
        </div>
    );
}

interface TreemapCanvasProps {
    data: Node;
    focusId?: string;
    onFocusChange?: (id: string) => void;
    onLeafOpen?: (node: Node) => void;
    onToggleCompletion?: (node: Node, completed: boolean) => void;
    onExport?: (node: Node) => void;
}

export function TreemapCanvas({
    data,
    focusId: externalFocusId,
    onFocusChange,
    onLeafOpen,
    onToggleCompletion,
    onExport,
}: TreemapCanvasProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const suppressZoomOutUntilRef = useRef(0);
    const [depthLevel, setDepthLevel] = useState(1); // 0, 1, 2, or 10 for "All"
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const [hoveredAction, setHoveredAction] = useState<{
        id: string;
        action: 'complete' | 'uncomplete';
    } | null>(null);

    // Cycle through depth levels: 0 → 1 → 2 → All(10) → 0
    const cycleDepth = () => {
        if (depthLevel === 0) setDepthLevel(1);
        else if (depthLevel === 1) setDepthLevel(2);
        else if (depthLevel === 2) setDepthLevel(10);
        else setDepthLevel(0);
    };

    const depthLabel = depthLevel >= 10 ? 'All' : String(depthLevel);

    const [internalFocusId, setInternalFocusId] = useState<string>(data.id);
    const isControlled = externalFocusId !== undefined;
    const focusId = isControlled ? externalFocusId : internalFocusId;

    const handleFocusChange = (newId: string) => {
        if (onFocusChange) {
            onFocusChange(newId);
        }
        if (!isControlled) {
            setInternalFocusId(newId);
        }
    };

    // Track container dimensions
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const updateDimensions = () => {
            const { width, height } = container.getBoundingClientRect();
            setDimensions({ width, height });
        };

        updateDimensions();
        const observer = new ResizeObserver(updateDimensions);
        observer.observe(container);
        return () => observer.disconnect();
    }, []);

    const isNodeComplete = (node: Node): boolean => {
        if (typeof node.progress === 'number') {
            return Math.round(node.progress) >= 100;
        }
        return node.isComplete === true;
    };

    // Find the focused node in the data tree
    const focusedData = useMemo(() => {
        if (!focusId || focusId === data.id) return data;
        const findNode = (node: Node, id: string): Node | null => {
            if (node.id === id) return node;
            for (const child of node.children ?? []) {
                const found = findNode(child, id);
                if (found) return found;
            }
            return null;
        };
        return findNode(data, focusId) ?? data;
    }, [data, focusId]);

    // Get breadcrumb ancestors
    const ancestors = useMemo(() => {
        const path: Node[] = [];
        const findPath = (node: Node, targetId: string): boolean => {
            if (node.id === targetId) {
                path.push(node);
                return true;
            }
            for (const child of node.children ?? []) {
                if (findPath(child, targetId)) {
                    path.unshift(node);
                    return true;
                }
            }
            return false;
        };
        findPath(data, focusId || data.id);
        return path;
    }, [data, focusId]);

    const handleNodeClick = (node: Node, e: React.MouseEvent) => {
        e.stopPropagation();

        const isLeaf = !node.children || node.children.length === 0;

        if (node.type === 'item' || isLeaf) {
            onLeafOpen?.(node);
        } else {
            // Zoom into folder
            handleFocusChange(node.id);
        }
    };

    const suppressNextZoomOut = () => {
        suppressZoomOutUntilRef.current = Date.now() + 350;
    };

    const handleZoomOut = (e: React.MouseEvent<HTMLDivElement>) => {
        if (Date.now() < suppressZoomOutUntilRef.current) {
            return;
        }
        if (e.target !== e.currentTarget) {
            return;
        }
        if (ancestors.length > 1) {
            const parentIndex = ancestors.length - 2;
            handleFocusChange(ancestors[parentIndex].id);
        }
    };

    // Calculate progress for a node
    const getProgress = (node: Node): number => {
        const isLeaf = !node.children || node.children.length === 0;

        // For leaf nodes, use the progress field if available, otherwise fallback to isComplete
        if (isLeaf) {
            if (node.progress !== undefined) return node.progress;
            return isNodeComplete(node) ? 100 : 0;
        }

        // For folders, compute average progress from all leaf descendants
        let totalProgress = 0;
        let leafCount = 0;

        const computeFromChildren = (n: Node) => {
            const nIsLeaf = !n.children || n.children.length === 0;
            if (nIsLeaf) {
                leafCount++;
                if (n.progress !== undefined) {
                    totalProgress += n.progress;
                } else if (isNodeComplete(n)) {
                    totalProgress += 100;
                }
            } else {
                n.children?.forEach(computeFromChildren);
            }
        };

        computeFromChildren(node);
        return leafCount > 0 ? Math.round(totalProgress / leafCount) : 0;
    };

    const children = focusedData.children ?? [];

    // Max depth for preview grid
    const maxPreviewDepth = depthLevel;

    // Calculate grid dimensions to fit screen
    const headerHeight = ancestors.length > 1 ? 56 : 48; // breadcrumb + toggle
    const availableHeight = dimensions.height - headerHeight - 32; // padding
    const availableWidth = dimensions.width - 32; // padding

    const itemCount = children.length || 1;
    // Calculate optimal grid layout based on available space
    const gap = 12;
    const labelHeight = 40; // Height for name + percentage below each cell

    // Find best column count that uses space efficiently
    const cols =
        Math.ceil(
            Math.sqrt(
                itemCount * (availableWidth / Math.max(availableHeight, 1)),
            ),
        ) || 1;
    const rows = Math.ceil(itemCount / cols);

    // Calculate cell size to fit everything
    const maxCellWidth = (availableWidth - (cols - 1) * gap) / cols;
    const maxCellHeight =
        (availableHeight - (rows - 1) * gap - rows * labelHeight) / rows;
    const cellSize = Math.min(maxCellWidth, maxCellHeight, 300); // max 300px

    return (
        <div
            ref={containerRef}
            className="w-full h-full bg-black relative overflow-hidden select-none flex flex-col"
            onClick={handleZoomOut}
        >
            {/* Header with breadcrumb and toggle */}
            <div className="flex items-center justify-between px-4 py-2 bg-black/80 backdrop-blur-sm z-50 shrink-0">
                {/* Breadcrumb */}
                <div className="flex items-center gap-1 text-sm flex-wrap min-w-0 flex-1 overflow-hidden">
                    {ancestors.length > 1 ? (
                        ancestors.map((a, i) => (
                            <span
                                key={a.id}
                                className="flex items-center gap-1"
                            >
                                {i > 0 && (
                                    <span className="text-neutral-600">/</span>
                                )}
                                <button
                                    type="button"
                                    className={cn(
                                        'text-neutral-400 hover:text-white transition px-1 py-0.5 rounded hover:bg-neutral-800',
                                        i === ancestors.length - 1 &&
                                            'text-white font-medium',
                                    )}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleFocusChange(a.id);
                                    }}
                                >
                                    {a.name}
                                </button>
                            </span>
                        ))
                    ) : (
                        <span className="text-white font-medium">
                            {focusedData.name}
                        </span>
                    )}
                </div>

                {/* Controls */}
                <div className="flex items-center gap-1 shrink-0">
                    {/* Depth cycle button */}
                    <button
                        type="button"
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition text-sm bg-neutral-900 text-neutral-300 hover:text-white hover:bg-neutral-800"
                        onClick={(e) => {
                            e.stopPropagation();
                            cycleDepth();
                        }}
                    >
                        <Layers className="w-4 h-4" />
                        <span className="font-mono min-w-[24px]">
                            {depthLabel}
                        </span>
                    </button>

                    {/* Home button */}
                    {focusId && focusId !== data.id && (
                        <button
                            type="button"
                            className="p-2 bg-neutral-900 text-neutral-400 hover:text-white rounded-lg transition hover:bg-neutral-800"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleFocusChange(data.id);
                            }}
                        >
                            <Home className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Grid of items */}
            <div className="flex-1 flex items-center justify-center p-4">
                <div
                    className="grid"
                    style={{
                        gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
                        gap: `${gap}px`,
                    }}
                >
                    {children.map((item) => {
                        const progress = getProgress(item);
                        const isLeaf =
                            !item.children || item.children.length === 0;
                        const isComplete = isNodeComplete(item);
                        const grandchildren = item.children ?? [];
                        const padding = Math.max(6, cellSize * 0.05);
                        // Inner radius should be outer radius (12px for rounded-xl) minus padding
                        const outerRadius = 12;
                        const innerRadius = Math.max(
                            4,
                            outerRadius - padding * 0.5,
                        );

                        const isHoveredForComplete =
                            hoveredAction?.action === 'complete' &&
                            (hoveredAction.id === item.id ||
                                ancestors.some(
                                    (a) => a.id === hoveredAction.id,
                                ));
                        const isHoveredForUncomplete =
                            hoveredAction?.action === 'uncomplete' &&
                            (hoveredAction.id === item.id ||
                                ancestors.some(
                                    (a) => a.id === hoveredAction.id,
                                ));

                        const cellContent = (
                            <div className="flex flex-col">
                                {/* Square cell */}
                                <div
                                    className={cn(
                                        'rounded-xl border overflow-hidden cursor-pointer transition-all duration-200 relative',
                                        'bg-neutral-900/60 border-neutral-700/30',
                                        !isHoveredForComplete &&
                                            !isHoveredForUncomplete &&
                                            'hover:border-neutral-500/50',
                                        isComplete &&
                                            !isHoveredForComplete &&
                                            !isHoveredForUncomplete &&
                                            'border-green-500/50 shadow-[0_0_12px_rgba(34,197,94,0.2)]',
                                        // Hover feedback
                                        isHoveredForComplete &&
                                            'border-green-500/80 shadow-[0_0_16px_rgba(34,197,94,0.4)] bg-green-500/10',
                                        isHoveredForUncomplete &&
                                            'border-rose-500/80 shadow-[0_0_16px_rgba(244,63,94,0.4)] bg-rose-500/10',
                                    )}
                                    style={{
                                        width: cellSize,
                                        height: cellSize,
                                        padding,
                                    }}
                                    onClick={(e) => handleNodeClick(item, e)}
                                >
                                    {/* Progress fill - hidden on parent, shown on children via PreviewGrid */}
                                    <div
                                        className="absolute bottom-0 left-0 w-full bg-green-500/70 transition-all duration-500 pointer-events-none"
                                        style={{
                                            height: `${progress}%`,
                                            opacity: isLeaf ? 1 : 0,
                                        }}
                                    />

                                    {/* Preview grid for children (recursive based on maxPreviewDepth) */}
                                    {!isLeaf && grandchildren.length > 0 && (
                                        <div
                                            className="w-full h-full pointer-events-none overflow-hidden relative z-10"
                                            style={{
                                                borderRadius: innerRadius,
                                            }}
                                        >
                                            <PreviewGrid
                                                children={grandchildren}
                                                getProgress={getProgress}
                                                maxDepth={maxPreviewDepth}
                                                showProgressFill={true}
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Label below cell */}
                                <div className="mt-2 text-center px-1">
                                    <span className="text-sm font-medium text-neutral-300 truncate block leading-tight">
                                        {item.name}
                                    </span>
                                    <span className="text-xs text-neutral-500 font-mono">
                                        {progress}%
                                    </span>
                                </div>
                            </div>
                        );

                        return (
                            <ContextMenu key={item.id}>
                                <ContextMenuTrigger asChild>
                                    {cellContent}
                                </ContextMenuTrigger>
                                <ContextMenuContent className="bg-neutral-900 border-neutral-700">
                                    <ContextMenuItem
                                        disabled={!onToggleCompletion}
                                        onClick={() => {
                                            suppressNextZoomOut();
                                            onToggleCompletion?.(item, true);
                                            setHoveredAction(null);
                                        }}
                                        onMouseEnter={() =>
                                            setHoveredAction({
                                                id: item.id,
                                                action: 'complete',
                                            })
                                        }
                                        onMouseLeave={() =>
                                            setHoveredAction(null)
                                        }
                                        className="text-neutral-200 focus:bg-neutral-800 focus:text-green-400 focus:bg-green-500/10"
                                    >
                                        <Check className="w-4 h-4 mr-2" />
                                        {isLeaf ? 'Erledigt' : 'Alle erledigt'}
                                    </ContextMenuItem>
                                    <ContextMenuItem
                                        disabled={!onToggleCompletion}
                                        onClick={() => {
                                            suppressNextZoomOut();
                                            onToggleCompletion?.(item, false);
                                            setHoveredAction(null);
                                        }}
                                        onMouseEnter={() =>
                                            setHoveredAction({
                                                id: item.id,
                                                action: 'uncomplete',
                                            })
                                        }
                                        onMouseLeave={() =>
                                            setHoveredAction(null)
                                        }
                                        className="text-neutral-200 focus:bg-neutral-800 focus:text-rose-400 focus:bg-rose-500/10"
                                    >
                                        <X className="w-4 h-4 mr-2" />
                                        {isLeaf
                                            ? 'Unerledigt'
                                            : 'Alle unerledigt'}
                                    </ContextMenuItem>
                                    <ContextMenuItem
                                        disabled={!onExport}
                                        onClick={() => {
                                            suppressNextZoomOut();
                                            onExport?.(item);
                                        }}
                                        className="text-neutral-200 focus:bg-neutral-800 focus:text-white"
                                    >
                                        Exportieren...
                                    </ContextMenuItem>
                                </ContextMenuContent>
                            </ContextMenu>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
