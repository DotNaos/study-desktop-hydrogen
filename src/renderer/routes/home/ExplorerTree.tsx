import {
    Check,
    ChevronDown,
    ChevronRight,
    FileText,
    Folder,
    Loader2,
    X,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useRef, useState } from 'react';
import { ActionContextMenu } from '../../app/components/ActionContextMenu';
import {
    collectAllIds,
    getLastVisibleDescendantId,
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

const emptyHoverInfo = {
    ids: new Set<string>(),
    rootId: null as string | null,
    lastId: null as string | null,
    type: null as 'done' | 'unmark' | null,
};

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
    const [hoverInfo, setHoverInfo] = useState(emptyHoverInfo);
    const menuOpenRef = useRef(false);

    const clearHover = useCallback(() => {
        setHoverInfo(emptyHoverInfo);
    }, []);

    const handleActionHover = useCallback(
        (node: ExplorerNode, type: 'done' | 'unmark' | null) => {
            // Guard: ignore hover events when the menu is closed (exit animation race)
            if (!menuOpenRef.current) {
                return;
            }

            if (!type) {
                clearHover();
                return;
            }

            const ids = collectAllIds(node);
            const lastId = getLastVisibleDescendantId(node, (id) =>
                expandedIds.has(id),
            );
            setHoverInfo({ ids: new Set(ids), rootId: node.id, lastId, type });
        },
        [clearHover],
    );

    const handleMenuOpenChange = useCallback(
        (open: boolean) => {
            menuOpenRef.current = open;
            if (!open) {
                clearHover();
            }
        },
        [clearHover],
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
            <div key={node.id} className="relative">
                {isHoverRoot && (
                    <div
                        className={cn(
                            'absolute inset-y-0 left-2 right-2 rounded-lg pointer-events-none z-0',
                            hoverInfo.type === 'done'
                                ? 'bg-green-500/10'
                                : 'bg-red-500/10',
                        )}
                    />
                )}
                <ActionContextMenu
                    isFolder={folder}
                    isCompleted={completed}
                    onPersistCompletion={(c: boolean) =>
                        onPersistCompletion(node, c)
                    }
                    onHoverAction={(action: 'done' | 'unmark' | null) =>
                        handleActionHover(node, action)
                    }
                    onExport={() => onOpenExportDialog(node)}
                    onOpenChange={handleMenuOpenChange}
                >
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
                            'relative z-10 flex items-center gap-2 px-2 py-1.5 text-left text-sm transition-all mx-2 w-[calc(100%-16px)] outline-none focus-visible:ring-2 focus-visible:ring-white/50 rounded-lg',
                            selected
                                ? 'bg-white/10 text-white font-medium shadow-sm'
                                : 'text-neutral-300 hover:bg-white/5 hover:text-neutral-100',
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
                        ) : isHovered ? (
                            hoverInfo.type === 'unmark' ? (
                                <X className="h-3.5 w-3.5 text-red-500 shrink-0" />
                            ) : (
                                <Check className="h-3.5 w-3.5 text-success shrink-0" />
                            )
                        ) : completed ? (
                            <Check className="h-3.5 w-3.5 text-success shrink-0" />
                        ) : null}

                        <div className="flex-1" />
                    </button>
                </ActionContextMenu>

                {folder && expanded && hasChildren && (
                    <div className="relative z-10">
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
