import { Check } from 'lucide-react';
import { cn } from '../../../shared/lib/utils';
import type { TreemapNode } from './treemapLayout';

interface TreemapNodeProps {
    node: TreemapNode;
    onClick?: (node: TreemapNode, e: React.MouseEvent) => void;
    completedIds: Set<string>;
    parentBounds?: { x0: number; y0: number };
    depth?: number;
    maxDepth?: number;
}

export function TreemapNodeComponent({
    node,
    onClick,
    completedIds,
    parentBounds,
    depth = 0,
    maxDepth = 2,
}: TreemapNodeProps) {
    const { x0, y0, x1, y1, data, children } = node;

    const px = parentBounds?.x0 ?? 0;
    const py = parentBounds?.y0 ?? 0;
    const width = x1 - x0;
    const height = y1 - y0;
    const left = x0 - px;
    const top = y0 - py;

    const isLeaf = !children || children.length === 0;
    const isItem = data.type === 'item' || isLeaf;
    const isComplete = data.isComplete || completedIds.has(data.id);

    const getProgress = (): number => {
        if (isLeaf) return isComplete ? 100 : 0;
        let complete = 0;
        let total = 0;
        node.each((n) => {
            const nodeIsLeaf = !n.children || n.children.length === 0;
            if (nodeIsLeaf) {
                total++;
                if (n.data.isComplete || completedIds.has(n.data.id)) complete++;
            }
        });
        return total > 0 ? Math.round((complete / total) * 100) : 0;
    };

    const progress = getProgress();
    const showLabel = width > 50 && height > 24;
    const showProgress = width > 60 && height > 36 && !isItem;

    if (width < 4 || height < 4) return null;

    return (
        <div
            className={cn(
                'absolute transition-all duration-200 overflow-hidden cursor-pointer',
                isItem
                    ? 'bg-neutral-800/90 border border-neutral-700/50 rounded-xl hover:border-neutral-500 hover:bg-neutral-700/80'
                    : 'bg-neutral-900/60 border border-neutral-700/30 rounded-2xl hover:border-neutral-600/50',
                isComplete &&
                    'border-green-500/50 shadow-[0_0_12px_rgba(34,197,94,0.2)]'
            )}
            style={{ left, top, width, height }}
            onClick={(e) => onClick?.(node, e)}
        >
            {/* Progress fill */}
            <div
                className="absolute bottom-0 left-0 w-full bg-green-500/15 transition-all duration-500 pointer-events-none rounded-b-xl"
                style={{ height: `${progress}%` }}
            />

            {/* Label */}
            {showLabel && (
                <div className="absolute top-2 left-3 right-3 z-10 pointer-events-none">
                    <span className="text-sm font-semibold text-neutral-200 truncate block leading-tight">
                        {data.name}
                    </span>
                    {showProgress && (
                        <span className="text-xs text-neutral-500 font-mono mt-0.5 block">
                            {progress}%
                        </span>
                    )}
                </div>
            )}

            {/* Completion checkmark for items */}
            {isItem && isComplete && width > 30 && height > 30 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <Check
                        className="w-5 h-5 text-green-500"
                        strokeWidth={3}
                    />
                </div>
            )}

            {/* Preview grid for folders with children */}
            {!isLeaf && children && children.length > 0 && (
                <div
                    className="absolute left-3 right-3 bottom-3 pointer-events-none"
                    style={{ top: showLabel ? 44 : 12 }}
                >
                    <div
                        className="w-full h-full grid gap-1"
                        style={{
                            gridTemplateColumns: `repeat(${Math.ceil(Math.sqrt(children.length))}, 1fr)`,
                        }}
                    >
                        {children.slice(0, 100).map((child) => {
                            const childIsLeaf =
                                !child.children || child.children.length === 0;
                            const childComplete =
                                child.data.isComplete ||
                                completedIds.has(child.data.id);

                            // Calculate child progress
                            let childProgress = 0;
                            if (childIsLeaf) {
                                childProgress = childComplete ? 100 : 0;
                            } else {
                                let complete = 0;
                                let total = 0;
                                child.each((n) => {
                                    const nIsLeaf = !n.children || n.children.length === 0;
                                    if (nIsLeaf) {
                                        total++;
                                        if (n.data.isComplete || completedIds.has(n.data.id))
                                            complete++;
                                    }
                                });
                                childProgress = total > 0 ? Math.round((complete / total) * 100) : 0;
                            }

                            return (
                                <div
                                    key={child.data.id}
                                    className="bg-neutral-700/50 rounded-lg relative overflow-hidden"
                                >
                                    <div
                                        className="absolute bottom-0 left-0 w-full bg-green-500/80 transition-all"
                                        style={{ height: `${childProgress}%` }}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
