import {
    Check,
    ChevronDown,
    ChevronRight,
    FileText,
    Folder,
    Loader2,
    Upload,
    X,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from '../../app/components/ui/context-menu';
import {
    collectAllIds,
    getLastDescendantId,
    getNodeCompletionValue,
    isFolderNode,
    type ExplorerNode,
} from '../../app/treeUtils';
import { cn } from '../../shared/lib/utils';

interface ExplorerTreeProps {
    roots: ExplorerNode[];
    completionMap: Map<string, boolean>;
    expandedIds: Set<string>;
    selectedResourceId: string | null;
    completionBusyId: string | null;
    onToggleExpanded: (nodeId: string) => void;
    onOpenResource: (nodeId: string) => void;
    onPersistCompletion: (node: ExplorerNode, completed: boolean) => void;
    onOpenExportDialog: (node: ExplorerNode) => void;
}

export function ExplorerTree({
    roots,
    completionMap,
    expandedIds,
    selectedResourceId,
    completionBusyId,
    onToggleExpanded,
    onOpenResource,
    onPersistCompletion,
    onOpenExportDialog,
}: ExplorerTreeProps) {
    const [hoverInfo, setHoverInfo] = useState<{
        ids: Set<string>;
        rootId: string | null;
        lastId: string | null;
        type: 'done' | 'unmark' | null;
    }>({ ids: new Set(), rootId: null, lastId: null, type: null });

    const handleActionHover = useCallback(
        (node: ExplorerNode, type: 'done' | 'unmark' | null) => {
            if (!type) {
                setHoverInfo({
                    ids: new Set(),
                    rootId: null,
                    lastId: null,
                    type: null,
                });
                return;
            }

            const ids = collectAllIds(node);
            const lastId = getLastDescendantId(node);
            setHoverInfo({ ids: new Set(ids), rootId: node.id, lastId, type });
        },
        [],
    );

    const renderNode = (node: ExplorerNode, depth: number): ReactNode => {
        const folder = isFolderNode(node);
        const completed = getNodeCompletionValue(node, completionMap);
        const selected = selectedResourceId === node.id;
        const expanded = expandedIds.has(node.id);
        const hasChildren = (node.children?.length ?? 0) > 0;
        const isBusy = completionBusyId === node.id;
        const isHovered = hoverInfo.ids.has(node.id);
        const isHoverRoot = hoverInfo.rootId === node.id;
        const isHoverLast = hoverInfo.lastId === node.id;

        const iconColorClass = isHovered
            ? hoverInfo.type === 'done'
                ? 'text-green-500'
                : 'text-red-500'
            : completed
              ? 'text-success'
              : 'text-neutral-500';

        const markCompletedLabel = folder ? 'Alle erledigt' : 'Erledigt';
        const markUncompletedLabel = folder
            ? 'Alles nicht erledigt'
            : 'Nicht erledigt';

        return (
            <div key={node.id}>
                <ContextMenu>
                    <ContextMenuTrigger asChild>
                        <button
                            type="button"
                            onClick={() => {
                                if (folder) {
                                    onToggleExpanded(node.id);
                                } else {
                                    onOpenResource(node.id);
                                }
                            }}
                            className={cn(
                                'flex items-center gap-2 px-2 py-1.5 text-left text-sm transition-all mx-2 w-[calc(100%-16px)] outline-none focus-visible:ring-2 focus-visible:ring-white/50',
                                selected
                                    ? 'bg-white/10 text-white font-medium shadow-sm rounded-lg'
                                    : 'text-neutral-300 hover:bg-white/5 hover:text-neutral-100 rounded-lg',
                                isHovered &&
                                    !selected &&
                                    cn(
                                        'shadow-none',
                                        isHoverRoot && 'rounded-t-lg',
                                        isHoverLast && 'rounded-b-lg',
                                        !isHoverRoot &&
                                            !isHoverLast &&
                                            'rounded-none',
                                        hoverInfo.type === 'done'
                                            ? 'bg-green-500/10 text-green-400/90'
                                            : 'bg-red-500/10 text-red-400/90',
                                    ),
                            )}
                            style={{ paddingLeft: `${depth * 14 + 8}px` }}
                        >
                            {folder ? (
                                hasChildren ? (
                                    expanded ? (
                                        <ChevronDown className="h-4 w-4 text-neutral-500 shrink-0" />
                                    ) : (
                                        <ChevronRight className="h-4 w-4 text-neutral-500 shrink-0" />
                                    )
                                ) : (
                                    <span className="w-4 shrink-0" />
                                )
                            ) : (
                                <span className="w-4 shrink-0" />
                            )}

                            {folder ? (
                                <Folder
                                    className={cn(
                                        'h-4 w-4 shrink-0',
                                        iconColorClass,
                                    )}
                                />
                            ) : (
                                <FileText
                                    className={cn(
                                        'h-4 w-4 shrink-0',
                                        iconColorClass,
                                    )}
                                />
                            )}

                            <span className="truncate">{node.name}</span>

                            {isBusy ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-neutral-500 shrink-0" />
                            ) : completed ||
                              (isHovered && hoverInfo.type === 'unmark') ? (
                                isHovered && hoverInfo.type === 'unmark' ? (
                                    <X className="h-3.5 w-3.5 text-red-500 shrink-0" />
                                ) : (
                                    <Check className="h-3.5 w-3.5 text-success shrink-0" />
                                )
                            ) : null}

                            <div className="flex-1" />
                        </button>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="bg-neutral-900 border-neutral-700 text-neutral-100">
                        <ContextMenuItem
                            disabled={completed}
                            onClick={() => onPersistCompletion(node, true)}
                            onMouseEnter={() => handleActionHover(node, 'done')}
                            onMouseLeave={() => handleActionHover(node, null)}
                            className="focus:bg-green-500/10 focus:text-green-400 cursor-pointer"
                        >
                            <Check className="mr-2 h-4 w-4 text-green-500" />
                            {markCompletedLabel}
                        </ContextMenuItem>
                        <ContextMenuItem
                            disabled={!completed}
                            onClick={() => onPersistCompletion(node, false)}
                            onMouseEnter={() =>
                                handleActionHover(node, 'unmark')
                            }
                            onMouseLeave={() => handleActionHover(node, null)}
                            className="focus:bg-red-500/10 focus:text-red-400 cursor-pointer"
                        >
                            <X className="mr-2 h-4 w-4 text-red-500" />
                            {markUncompletedLabel}
                        </ContextMenuItem>
                        <ContextMenuSeparator className="bg-neutral-700" />
                        <ContextMenuItem
                            onClick={() => onOpenExportDialog(node)}
                            className="focus:bg-neutral-800 focus:text-white"
                        >
                            <Upload className="mr-2 h-4 w-4" />
                            Exportieren...
                        </ContextMenuItem>
                    </ContextMenuContent>
                </ContextMenu>

                {folder && expanded && hasChildren && (
                    <div>
                        {node.children?.map((child) =>
                            renderNode(child, depth + 1),
                        )}
                    </div>
                )}
            </div>
        );
    };

    return <>{roots.map((node) => renderNode(node, 0))}</>;
}
