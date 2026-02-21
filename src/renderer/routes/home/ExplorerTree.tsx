import { Check, ChevronDown, ChevronRight, FileText, Folder, Loader2, Upload } from 'lucide-react';
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

        const completionLabel = folder
            ? completed
                ? 'Alle Ressourcen als unerledigt markieren'
                : 'Alle Ressourcen als erledigt markieren'
            : completed
              ? 'Als unerledigt markieren'
              : 'Als erledigt markieren';

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
                            onClick={() => onPersistCompletion(node, !completed)}
                            className="focus:bg-slate-800 focus:text-white"
                        >
                            <Check className="mr-2 h-4 w-4" />
                            {completionLabel}
                        </ContextMenuItem>
                        <ContextMenuSeparator className="bg-slate-700" />
                        <ContextMenuItem
                            onClick={() => onOpenExportDialog(node)}
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

    return <>{roots.map((node) => renderNode(node, 0))}</>;
}
