import { Check, Upload, X } from 'lucide-react';
import type { ReactNode } from 'react';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from './ui/context-menu';

export interface ActionContextMenuProps {
    children: ReactNode;
    isFolder: boolean;
    isCompleted: boolean;
    onPersistCompletion?: (completed: boolean) => void;
    onHoverAction?: (action: 'done' | 'unmark' | null) => void;
    onExport?: () => void;
    onOpenChange?: (open: boolean) => void;
}

export function ActionContextMenu({
    children,
    isFolder,
    isCompleted,
    onPersistCompletion,
    onHoverAction,
    onExport,
    onOpenChange,
}: ActionContextMenuProps) {
    const markCompletedLabel = isFolder ? 'Alle erledigt' : 'Erledigt';
    const markUncompletedLabel = isFolder
        ? 'Alles nicht erledigt'
        : 'Nicht erledigt';

    return (
        <ContextMenu onOpenChange={onOpenChange}>
            <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
            <ContextMenuContent className="bg-neutral-900 border-neutral-700 data-[state=closed]:pointer-events-none z-[100]">
                {onPersistCompletion && (
                    <>
                        <ContextMenuItem
                            disabled={isCompleted}
                            onClick={() => onPersistCompletion(true)}
                            onMouseEnter={() => onHoverAction?.('done')}
                            onMouseLeave={() => onHoverAction?.(null)}
                            className="text-neutral-200 focus:bg-green-500/10 focus:text-green-400 cursor-pointer"
                        >
                            <Check className="mr-2 h-4 w-4 text-green-500" />
                            {markCompletedLabel}
                        </ContextMenuItem>
                        <ContextMenuItem
                            disabled={!isCompleted}
                            onClick={() => onPersistCompletion(false)}
                            onMouseEnter={() => onHoverAction?.('unmark')}
                            onMouseLeave={() => onHoverAction?.(null)}
                            className="text-neutral-200 focus:bg-red-500/10 focus:text-red-400 cursor-pointer"
                        >
                            <X className="mr-2 h-4 w-4 text-red-500" />
                            {markUncompletedLabel}
                        </ContextMenuItem>
                    </>
                )}
                {onPersistCompletion && onExport && (
                    <ContextMenuSeparator className="bg-neutral-700" />
                )}
                {onExport && (
                    <ContextMenuItem
                        onClick={onExport}
                        className="text-neutral-200 focus:bg-neutral-800 focus:text-white cursor-pointer"
                    >
                        <Upload className="mr-2 h-4 w-4" />
                        Exportieren...
                    </ContextMenuItem>
                )}
            </ContextMenuContent>
        </ContextMenu>
    );
}
