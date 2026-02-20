import { useNavigate } from '@tanstack/react-router';
import { animate } from 'animejs';
import { clsx, type ClassValue } from 'clsx';
import { Check, Home } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { twMerge } from 'tailwind-merge';
import type { Node } from '../zoomData';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface ZoomCanvasProps {
    data: Node;
    focusId?: string;
    onFocusChange?: (id: string) => void;
}

// Visual Config
const SIZES = {
    0: 300, // Root
    1: 240, // Course
    2: 160, // Chapter
    leaf: 100, // Task
};

interface LayoutNode {
    id: string;
    x: number;
    y: number;
    size: number;
    width: number;
    height: number;
    depth: number;
    parentId: string | null;
}

// --- GRID LAYOUT ENGINE ---
const calculateLayout = (
    node: Node,
    depth = 0,
    x = 0,
    y = 0,
    parentId: string | null = null,
    map = new Map<string, LayoutNode>(),
) => {
    const isLeaf = node.type === 'item';

    let size = SIZES.leaf;
    if (!isLeaf) {
        // @ts-ignore
        size = SIZES[depth] || 100;
    }

    let boundsWidth = size;
    let boundsHeight = size;

    if (!isLeaf && node.children) {
        const total = node.children.length;
        const cols = Math.ceil(Math.sqrt(total));
        const gap = size * 0.4;

        // @ts-ignore
        const childSize = isLeaf ? SIZES.leaf : SIZES[depth + 1] || 100;
        const cellSize = childSize + gap;

        const gridWidth = cols * cellSize - gap;
        const rows = Math.ceil(total / cols);
        const gridHeight = rows * cellSize - gap;

        boundsWidth = Math.max(size, gridWidth);
        boundsHeight = Math.max(size, gridHeight);

        const startX = x - gridWidth / 2 + childSize / 2;
        const startY = y - gridHeight / 2 + childSize / 2;

        node.children.forEach((child, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const childX = startX + col * cellSize;
            const childY = startY + row * cellSize;
            calculateLayout(child, depth + 1, childX, childY, node.id, map);
        });
    }

    map.set(node.id, {
        id: node.id,
        x,
        y,
        size,
        width: boundsWidth,
        height: boundsHeight,
        depth,
        parentId,
    });
    return map;
};

// Find path from Root to TargetId
const getAncestryPath = (
    targetId: string,
    layoutMap: Map<string, LayoutNode>,
): Set<string> => {
    const path = new Set<string>();
    let currentId: string | null = targetId;
    while (currentId) {
        path.add(currentId);
        const node = layoutMap.get(currentId);
        currentId = node?.parentId || null;
    }
    return path;
};

const findNode = (id: string, node: Node): Node | null => {
    if (node.id === id) return node;
    if (node.children) {
        for (const child of node.children) {
            const found = findNode(id, child);
            if (found) return found;
        }
    }
    return null;
};

export function ZoomCanvas({
    data,
    focusId: externalFocusId,
    onFocusChange,
}: ZoomCanvasProps) {
    const navigate = useNavigate();
    const worldRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // If externalFocusId provided, use it. Otherwise fallback to data.id.
    // If no external control, we could support internal state, but for now we rely on prop if passed.
    // To support both, we'd need useControllableState or similar.
    // For this request, we assume it's controlled by URL now.
    // But to be safe, if external is missing, use internal state?
    // The user wants URL sync. I'll prioritize external.

    const [internalFocusId, setInternalFocusId] = useState<string>(data.id);
    const isControlled = externalFocusId !== undefined;
    const focusId = isControlled ? externalFocusId : internalFocusId;

    const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

    const layoutMap = useRef(new Map<string, LayoutNode>()).current;

    const handleFocusChange = (newId: string) => {
        if (onFocusChange) {
            onFocusChange(newId);
        }
        if (!isControlled) {
            setInternalFocusId(newId);
        }
    };

    useEffect(() => {
        layoutMap.clear();
        calculateLayout(data, 0, 0, 0, null, layoutMap);
    }, [data, layoutMap]);

    useEffect(() => {
        const initial = new Set<string>();
        const scan = (n: Node) => {
            if (n.isComplete) initial.add(n.id);
            n.children?.forEach(scan);
        };
        scan(data);
        setCompletedIds(initial);
    }, [data]);

    const handleNodeClick = (e: React.MouseEvent, node: Node) => {
        e.stopPropagation();
        if (node.type === 'item') {
            // Navigate to task
            if (node.courseId && node.taskId) {
                navigate({
                    to: '/course/$courseId/task/$taskId',
                    params: {
                        courseId: node.courseId,
                        taskId: node.taskId,
                    },
                });
            }
        } else {
            // Zoom in
            if (onFocusChange) onFocusChange(node.id);
        }
    };

    const handleZoomOut = (e: React.MouseEvent) => {
        e.stopPropagation();
        const currentNode = layoutMap.get(focusId);
        if (currentNode && currentNode.parentId) {
            handleFocusChange(currentNode.parentId);
        }
    };

    // Camera Effect
    useEffect(() => {
        if (!worldRef.current || !containerRef.current) return;

        const targetLayout = layoutMap.get(focusId);
        if (!targetLayout) return;

        const containerWidth = containerRef.current.offsetWidth;
        const containerHeight = containerRef.current.offsetHeight;

        const fitWidth = targetLayout.width * 1.5;
        const fitHeight = targetLayout.height * 1.5;
        const visualSize = Math.max(fitWidth, fitHeight, 600);

        const scale = Math.min(containerWidth, containerHeight) / visualSize;
        const translateX = containerWidth / 2 - targetLayout.x * scale;
        const translateY = containerHeight / 2 - targetLayout.y * scale;

        animate(worldRef.current, {
            translateX,
            translateY,
            scale,
            duration: 800,
            easing: 'outExpo',
        });
    }, [focusId, data, layoutMap]);

    const getStats = (
        node: Node,
    ): { percentage: number; complete: number; total: number } => {
        if (node.type === 'item') {
            const isComplete = completedIds.has(node.id);
            return {
                percentage: isComplete ? 100 : 0,
                complete: isComplete ? 1 : 0,
                total: 1,
            };
        }
        let complete = 0;
        let total = 0;
        const countAll = (n: Node) => {
            if (n.type === 'item') {
                total++;
                if (completedIds.has(n.id)) complete++;
            }
            n.children?.forEach(countAll);
        };
        countAll(node);
        return {
            percentage: total > 0 ? Math.round((complete / total) * 100) : 0,
            complete,
            total,
        };
    };

    // --- RENDERER ---
    const ancestryPath = getAncestryPath(focusId, layoutMap);
    const focusNodeData = findNode(focusId, data);
    const focusNodeStats = focusNodeData
        ? getStats(focusNodeData)
        : { percentage: 0, complete: 0, total: 0 };

    const renderNode = (node: Node, depth = 0) => {
        const isLeaf = node.type === 'item';
        const stats = getStats(node);
        const pos = layoutMap.get(node.id) || {
            x: 0,
            y: 0,
            size: 100,
            depth: 0,
            parentId: null,
            width: 100,
            height: 100,
        };

        const isFocus = node.id === focusId;
        const isAncestor = ancestryPath.has(node.id);
        const parentIsFocus = pos.parentId === focusId;

        if (!isAncestor && !parentIsFocus) return null;

        const style: React.CSSProperties = {
            left: pos.x,
            top: pos.y,
            width: pos.size,
            height: pos.size,
            transform: 'translate(-50%, -50%)',
            opacity: isAncestor && !isFocus ? 0 : 1,
        };

        const glassBase =
            'w-full h-full rounded-3xl shadow-xl border border-neutral-800 bg-neutral-900/40 backdrop-blur-md overflow-hidden transition-all hover:border-neutral-600 flex flex-col items-center justify-center';

        const Label = () => (
            <div className="absolute top-[105%] w-[120%] left-1/2 -translate-x-1/2 text-center pointer-events-none">
                <span className="text-sm font-bold text-neutral-300 drop-shadow-md leading-tight line-clamp-2 px-1">
                    {node.name}
                </span>
                {stats.total > 0 && (
                    <div className="text-[10px] font-mono text-neutral-500 mt-1">
                        {stats.percentage}%
                    </div>
                )}
            </div>
        );

        if (isLeaf) {
            const isComplete = completedIds.has(node.id);
            return (
                <div
                    key={node.id}
                    id={`node-${node.id}`}
                    className="absolute z-10 transition-transform hover:scale-105 cursor-pointer"
                    style={style}
                    onClick={(e) => handleNodeClick(e, node)}
                >
                    <div
                        className={cn(
                            glassBase,
                            isComplete
                                ? 'shadow-[0_0_15px_rgba(34,197,94,0.3)] bg-neutral-900/60'
                                : 'bg-neutral-900/30',
                        )}
                    >
                        <div
                            className={cn(
                                'absolute bottom-0 left-0 w-full transition-all duration-300 ease-out',
                                isComplete
                                    ? 'h-full bg-green-500'
                                    : 'h-0 bg-green-500',
                            )}
                        />
                        <div className="relative z-20">
                            {isComplete && (
                                <Check
                                    strokeWidth={4}
                                    className="w-8 h-8 text-black"
                                />
                            )}
                        </div>
                    </div>
                    <Label />
                </div>
            );
        }

        // --- PREVIEW GRID (Child of Focus) ---
        if (parentIsFocus) {
            const children = node.children || [];
            const childCount = children.length;
            const cols = Math.ceil(Math.sqrt(childCount)) || 1;

            const parentPadding = 8;
            const gap = 4;
            const parentBorderRadius = 24;
            const cellBorderRadius = Math.max(
                0,
                parentBorderRadius - parentPadding - gap,
            );

            return (
                <div
                    key={node.id}
                    id={`node-${node.id}`}
                    className="absolute z-10 transition-transform hover:scale-105 cursor-pointer"
                    style={style}
                    onClick={(e) => handleNodeClick(e, node)}
                >
                    <div
                        className={glassBase}
                        style={{ padding: parentPadding }}
                    >
                        {/* Square Packing Grid - Aligned Top */}
                        <div
                            className="w-full h-full grid gap-1 content-start justify-center"
                            style={{
                                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                            }}
                        >
                            {children.map((child, index) => {
                                const childStats = getStats(child);
                                const isChildLeaf = child.type === 'item';
                                const isTopLeft = index === 0;
                                const isTopRight = index === cols - 1;
                                const isBottomLeft =
                                    index >= childCount - cols &&
                                    index % cols === 0;
                                const isBottomRight = index === childCount - 1;
                                const isCorner =
                                    isTopLeft ||
                                    isTopRight ||
                                    isBottomLeft ||
                                    isBottomRight;

                                return (
                                    <div
                                        key={child.id}
                                        className="bg-neutral-800/80 relative overflow-hidden w-full"
                                        style={{
                                            aspectRatio: '1/1',
                                            borderRadius: isCorner
                                                ? `${cellBorderRadius}px`
                                                : '0px',
                                            borderTopLeftRadius: isTopLeft
                                                ? `${cellBorderRadius}px`
                                                : undefined,
                                            borderTopRightRadius: isTopRight
                                                ? `${cellBorderRadius}px`
                                                : undefined,
                                            borderBottomLeftRadius: isBottomLeft
                                                ? `${cellBorderRadius}px`
                                                : undefined,
                                            borderBottomRightRadius:
                                                isBottomRight
                                                    ? `${cellBorderRadius}px`
                                                    : undefined,
                                        }}
                                    >
                                        <div
                                            className="absolute bottom-0 left-0 w-full bg-green-500 transition-all duration-500"
                                            style={{
                                                height: isChildLeaf
                                                    ? childStats.percentage ===
                                                      100
                                                        ? '100%'
                                                        : '0%'
                                                    : `${childStats.percentage}%`,
                                            }}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <Label />
                </div>
            );
        }

        if (isFocus) {
            return (
                <div key={node.id}>
                    {node.children?.map((child) =>
                        renderNode(child, depth + 1),
                    )}
                </div>
            );
        }

        return (
            <div key={node.id}>
                {node.children?.map((child) => renderNode(child, depth + 1))}
            </div>
        );
    };

    return (
        <div
            ref={containerRef}
            className="w-full h-screen overflow-hidden bg-black relative select-none font-sans"
            onClick={handleZoomOut}
        >
            {focusId !== data.id && (
                <button
                    className="absolute top-8 right-8 z-50 pointer-events-auto p-3 bg-neutral-900 text-neutral-400 hover:text-white rounded-full transition"
                    onClick={(e) => {
                        e.stopPropagation();
                        handleFocusChange(data.id);
                    }}
                >
                    <Home className="w-5 h-5" />
                </button>
            )}

            {/* The World */}
            <div
                ref={worldRef}
                className="absolute top-0 left-0 origin-top-left will-change-transform"
            >
                {renderNode(data)}
            </div>
        </div>
    );
}
