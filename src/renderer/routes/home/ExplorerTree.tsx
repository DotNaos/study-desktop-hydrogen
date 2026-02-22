import {
    Check,
    ChevronDown,
    ChevronRight,
    FileText,
    Folder,
    Loader2,
    Upload,
} from 'lucide-react';
import type { ReactNode } from 'react';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from '../../app/components/ui/context-menu';
import {
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
    const renderNode = (node: ExplorerNode, depth: number): ReactNode => {
        const folder = isFolderNode(node);
        const completed = getNodeCompletionValue(node, completionMap);
        const selected = selectedResourceId === node.id;
        const expanded = expandedIds.has(node.id);
        const hasChildren = (node.children?.length ?? 0) > 0;
        const isBusy = completionBusyId === node.id;

        const markCompletedLabel = folder
            ? 'Alle Ressourcen als erledigt markieren'
            : 'Als erledigt markieren';
        const markUncompletedLabel = folder
            ? 'Alle Ressourcen als unerledigt markieren'
            : 'Als unerledigt markieren';

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
                                'flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors mx-2 w-[calc(100%-16px)] outline-none focus-visible:ring-2 focus-visible:ring-white/50',
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
                                        completed
                                            ? 'text-success'
                                            : 'text-neutral-500',
                                    )}
                                />
                            ) : (
                                <FileText
                                    className={cn(
                                        'h-4 w-4 shrink-0',
                                        completed
                                            ? 'text-success'
                                            : 'text-neutral-500',
                                    )}
                                />
                            )}

                            <span className="truncate">{node.name}</span>

                            {isBusy ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-neutral-500 shrink-0" />
                            ) : completed ? (
                                <Check className="h-3.5 w-3.5 text-success shrink-0" />
                            ) : null}

                            <div className="flex-1" />
                        </button>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="bg-neutral-900 border-neutral-700 text-neutral-100">
                        <ContextMenuItem
                            disabled={completed}
                            onClick={() => onPersistCompletion(node, true)}
                            className="focus:bg-neutral-800 focus:text-white"
                        >
                            <Check className="mr-2 h-4 w-4" />
                            {markCompletedLabel}
                        </ContextMenuItem>
                        <ContextMenuItem
                            disabled={!completed}
                            onClick={() => onPersistCompletion(node, false)}
                            className="focus:bg-neutral-800 focus:text-white"
                        >
                            <Check className="mr-2 h-4 w-4" />
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
