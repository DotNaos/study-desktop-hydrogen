import { cn } from '@aryazos/ui/lib/utils';
import { Button, Checkbox } from '@aryazos/ui/shadcn';
import { cva } from 'class-variance-authority';
import {
    Check,
    Database,
    Folder,
    RefreshCw,
    Trash2,
    X as XIcon,
} from 'lucide-react';
import { FileExtensionIcon } from './fileIcons';
import type { LocalStackItem } from './types';

type LocalStackViewProps = {
    localStack: LocalStackItem[];
    showResolved: boolean;
    setShowResolved: (value: boolean) => void;
    isPathIgnored: (path: string, name: string) => boolean;
    onSelectItem: (path: string) => void;
    onIgnoreItem: (item: {
        path: string;
        name: string;
        isFolder: boolean;
    }) => void;
    onIndexRemote: () => void;
    onRefresh: () => void;
    onClearAll: () => void;
    loading: boolean;
    error: string | null;
    onDismissError: () => void;
};

const stackItemVariants = cva(
    'group flex items-center gap-2 px-3 py-1 hover:bg-accent/50 w-full cursor-pointer transition-colors',
    {
        variants: {
            status: {
                pending: '',
                mapped: 'text-blue-600 dark:text-blue-400 font-medium',
                ignored: 'text-muted-foreground opacity-50',
            },
        },
        defaultVariants: {
            status: 'pending',
        },
    },
);

export function LocalStackView({
    localStack,
    showResolved,
    setShowResolved,
    isPathIgnored,
    onSelectItem,
    onIgnoreItem,
    onIndexRemote,
    onRefresh,
    onClearAll,
    loading,
    error,
    onDismissError,
}: LocalStackViewProps) {
    const { pending, mapped, ignored } = localStack.reduce(
        (acc, item) => {
            if (isPathIgnored(item.path, item.name)) {
                acc.ignored.push(item);
            } else if (item.resolved) {
                acc.mapped.push(item);
            } else {
                acc.pending.push(item);
            }
            return acc;
        },
        {
            pending: [] as LocalStackItem[],
            mapped: [] as LocalStackItem[],
            ignored: [] as LocalStackItem[],
        },
    );

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
                <div>
                    <h1 className="text-sm font-medium">Local Stack</h1>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        {pending.length} pending · {mapped.length} mapped
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer mr-2">
                        <Checkbox
                            checked={showResolved}
                            onCheckedChange={(checked) =>
                                setShowResolved(checked === true)
                            }
                        />
                        Show resolved
                    </label>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={onIndexRemote}
                            disabled={loading}
                            title="Index Moodle Courses"
                        >
                            <Database className="w-4 h-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={onRefresh}
                            disabled={loading}
                            title="Refresh"
                        >
                            <RefreshCw
                                className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
                            />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => {
                                if (confirm('Clear all?')) onClearAll();
                            }}
                            title="Clear"
                            className="text-destructive hover:text-destructive"
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {error && (
                <div className="px-3 py-2 bg-destructive/10 text-destructive text-sm border-b border-destructive/20">
                    {error}
                    <Button
                        variant="link"
                        size="sm"
                        onClick={onDismissError}
                        className="ml-2 h-auto p-0"
                    >
                        Dismiss
                    </Button>
                </div>
            )}

            <div className="flex-1 overflow-y-auto">
                {localStack.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
                        <Folder className="w-12 h-12 mb-3 opacity-40" />
                        <p className="text-sm">No local files to map</p>
                    </div>
                ) : (
                    <>
                        {/* Pending Section */}
                        {pending.length > 0 && (
                            <div>
                                <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide bg-muted/20 sticky top-0">
                                    Pending
                                </div>
                                {pending.map((item) => (
                                    <StackItem
                                        key={item.path}
                                        item={item}
                                        status="pending"
                                        onSelect={() => onSelectItem(item.path)}
                                        onIgnore={() => onIgnoreItem(item)}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Mapped Section */}
                        {showResolved && mapped.length > 0 && (
                            <div className="border-t border-border">
                                <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide bg-muted/20 sticky top-0">
                                    Mapped
                                </div>
                                {mapped.map((item) => (
                                    <StackItem
                                        key={item.path}
                                        item={item}
                                        status="mapped"
                                        onSelect={() => onSelectItem(item.path)}
                                        onIgnore={() => onIgnoreItem(item)}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Ignored Section */}
                        {showResolved && ignored.length > 0 && (
                            <div className="border-t border-border">
                                <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide bg-muted/20 sticky top-0">
                                    Ignored
                                </div>
                                {ignored.map((item) => (
                                    <StackItem
                                        key={item.path}
                                        item={item}
                                        status="ignored"
                                        onSelect={() => onSelectItem(item.path)}
                                        onIgnore={() => onIgnoreItem(item)}
                                    />
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

function StackItem({
    item,
    status,
    onSelect,
    onIgnore,
}: {
    item: LocalStackItem;
    status: 'pending' | 'mapped' | 'ignored';
    onSelect: () => void;
    onIgnore: () => void;
}) {
    const isIgnored = status === 'ignored';
    const isMapped = status === 'mapped';

    // Extract extension from item name
    const getExtension = (): string | undefined => {
        if (item.isFolder) return undefined;
        const match = item.name.match(/\.([a-zA-Z0-9]+)$/);
        return match?.[1];
    };

    return (
        <div className={cn(stackItemVariants({ status }))}>
            <button
                onClick={onSelect}
                className="flex-1 flex items-center gap-2 py-1 text-left min-w-0 cursor-pointer"
                disabled={isIgnored}
            >
                {item.isFolder ? (
                    <Folder className="w-4 h-4 shrink-0" />
                ) : (
                    <FileExtensionIcon
                        extension={getExtension()}
                        size={16}
                        className="shrink-0"
                    />
                )}
                <span className="flex-1 text-sm truncate">{item.name}</span>
                {isMapped && <Check className="w-4 h-4 shrink-0" />}
            </button>

            {/* Action Buttons */}
            {!isIgnored && !isMapped && (
                <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={(e) => {
                        e.stopPropagation();
                        onIgnore();
                    }}
                    className="opacity-0 group-hover:opacity-100 h-7 w-7"
                    title="Ignore"
                >
                    <XIcon className="w-4 h-4" />
                </Button>
            )}
        </div>
    );
}
