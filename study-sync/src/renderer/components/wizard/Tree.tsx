import { cn } from '@aryazos/ui/lib/utils';
import { Button, Checkbox, Input } from '@aryazos/ui/shadcn';
import {
    Check,
    ChevronDown,
    ChevronRight,
    Folder,
    Loader2,
    X,
} from 'lucide-react';
import React, { useState } from 'react';
import { FileExtensionIcon } from './fileIcons';

export type TreeNode<T = any> = {
    id: string;
    name: string;
    type: 'file' | 'folder';
    children?: TreeNode<T>[];
    data?: T;
    icon?: React.ReactNode;
    isLoading?: boolean;
    isLoaded?: boolean;
};

export type TreeItemContext = {
    startEdit: () => void;
};

export type TreeAction<T> = {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    onClick: (node: TreeNode<T>, context: TreeItemContext) => void;
    visible?: (node: TreeNode<T>) => boolean;
    variant?: 'ghost' | 'destructive' | 'default';
};

export type TreeProps<T> = {
    data: TreeNode<T>[];

    // Expansion
    expandedIds?: Set<string>;
    onExpand?: (node: TreeNode<T>) => void;
    onCollapse?: (node: TreeNode<T>) => void;

    // Selection
    selectedIds?: Set<string>;
    indeterminateIds?: Set<string>;
    onSelect?: (node: TreeNode<T>, multi?: boolean) => void;
    selectionMode?: 'single' | 'multi' | 'checkbox';

    // Rendering
    renderLabel?: (node: TreeNode<T>) => React.ReactNode;
    renderStartIcon?: (node: TreeNode<T>) => React.ReactNode;
    renderEndContent?: (node: TreeNode<T>) => React.ReactNode;

    // Actions
    actions?: TreeAction<T>[];

    // Editing
    editable?: boolean;
    onRename?: (node: TreeNode<T>, newName: string) => void;

    className?: string; // Container class
    getRowClassName?: (node: TreeNode<T>) => string;

    // Async
    onLoadChildren?: (node: TreeNode<T>) => void;
};

export function Tree<T>({
    data,
    expandedIds,
    onExpand,
    onCollapse,
    selectedIds,
    indeterminateIds,
    onSelect,
    selectionMode = 'single',
    renderLabel,
    renderStartIcon,
    renderEndContent,
    actions,
    editable,
    onRename,
    className,
    getRowClassName,
    onLoadChildren,
}: TreeProps<T>) {
    // Local state for uncontrolled expansion if expandedIds not provided
    const [localExpanded, setLocalExpanded] = useState<Set<string>>(new Set());
    const isControlledExpanded = expandedIds !== undefined;
    const currentExpanded = isControlledExpanded ? expandedIds : localExpanded;

    const handleToggle = (node: TreeNode<T>) => {
        if (currentExpanded.has(node.id)) {
            if (onCollapse) onCollapse(node);
            if (!isControlledExpanded) {
                const next = new Set(localExpanded);
                next.delete(node.id);
                setLocalExpanded(next);
            }
        } else {
            if (onExpand) onExpand(node);
            if (onLoadChildren && !node.isLoaded && !node.children?.length) {
                onLoadChildren(node);
            }
            if (!isControlledExpanded) {
                const next = new Set(localExpanded);
                next.add(node.id);
                setLocalExpanded(next);
            }
        }
    };

    return (
        <div className={cn('flex flex-col', className)}>
            {data.map((node) => (
                <TreeItem
                    key={node.id}
                    node={node}
                    depth={0}
                    expandedIds={currentExpanded}
                    onToggle={handleToggle}
                    selectedIds={selectedIds}
                    indeterminateIds={indeterminateIds}
                    onSelect={onSelect}
                    selectionMode={selectionMode}
                    renderLabel={renderLabel}
                    renderStartIcon={renderStartIcon}
                    renderEndContent={renderEndContent}
                    actions={actions}
                    editable={editable}
                    onRename={onRename}
                    getRowClassName={getRowClassName}
                />
            ))}
        </div>
    );
}

function TreeItem<T>({
    node,
    depth,
    expandedIds,
    onToggle,
    selectedIds,
    indeterminateIds,
    onSelect,
    selectionMode,
    renderLabel,
    renderStartIcon,
    renderEndContent,
    actions,
    editable,
    onRename,
    getRowClassName,
}: {
    node: TreeNode<T>;
    depth: number;
    expandedIds: Set<string>;
    onToggle: (node: TreeNode<T>) => void;
    selectedIds?: Set<string>;
    indeterminateIds?: Set<string>;
    onSelect?: (node: TreeNode<T>, multi?: boolean) => void;
    selectionMode: 'single' | 'multi' | 'checkbox';
    renderLabel?: (node: TreeNode<T>) => React.ReactNode;
    renderStartIcon?: (node: TreeNode<T>) => React.ReactNode;
    renderEndContent?: (node: TreeNode<T>) => React.ReactNode;
    actions?: TreeAction<T>[];
    editable?: boolean;
    onRename?: (node: TreeNode<T>, newName: string) => void;
    getRowClassName?: (node: TreeNode<T>) => string;
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(node.name);

    const isExpanded = expandedIds.has(node.id);
    const isSelected = selectedIds?.has(node.id);
    const hasChildren = node.children && node.children.length > 0;

    const handleSelect = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onSelect) onSelect(node, e.metaKey || e.ctrlKey);
    };

    const confirmEdit = () => {
        if (editValue.trim() && editValue !== node.name && onRename) {
            onRename(node, editValue.trim());
        }
        setIsEditing(false);
    };

    const cancelEdit = () => {
        setIsEditing(false);
        setEditValue(node.name);
    };

    const context: TreeItemContext = {
        startEdit: () => {
            if (editable) {
                setIsEditing(true);
                setEditValue(node.name);
            }
        },
    };

    return (
        <div>
            <div
                className={cn(
                    'group flex items-center gap-1 hover:bg-muted/50 transition-colors cursor-pointer select-none text-sm',
                    isSelected &&
                        selectionMode !== 'checkbox' &&
                        'bg-accent text-accent-foreground',
                    getRowClassName?.(node),
                )}
                onClick={(e) => {
                    if (selectionMode === 'checkbox') {
                        if (node.type === 'folder') {
                            onToggle(node);
                        } else {
                            handleSelect(e);
                        }
                    } else {
                        handleSelect(e);
                        if (node.type === 'folder' || hasChildren) {
                            onToggle(node);
                        }
                    }
                }}
            >
                {/* Left Content (Indented via nesting, padded locally) */}
                <div className="flex items-center flex-1 min-w-0 py-1.5 pl-2">
                    {/* Checkbox */}
                    {selectionMode === 'checkbox' && (
                        <div
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onSelect) onSelect(node);
                            }}
                            className="shrink-0 mr-1"
                        >
                            <Checkbox
                                checked={
                                    indeterminateIds?.has(node.id)
                                        ? 'indeterminate'
                                        : isSelected
                                }
                            />
                        </div>
                    )}

                    {/* Expand Toggle */}
                    <div
                        className="w-5 h-5 flex items-center justify-center shrink-0 text-muted-foreground hover:text-foreground"
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggle(node);
                        }}
                    >
                        {node.isLoading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : node.type === 'folder' || hasChildren ? (
                            isExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5" />
                            ) : (
                                <ChevronRight className="w-3.5 h-3.5" />
                            )
                        ) : (
                            <div className="w-3.5" />
                        )}
                    </div>

                    {/* Icon */}
                    {renderStartIcon ? (
                        renderStartIcon(node)
                    ) : node.type === 'folder' ? (
                        <Folder className="w-4 h-4 text-blue-500 shrink-0 mr-1.5" />
                    ) : (
                        <FileExtensionIcon
                            extension={node.name.split('.').pop()}
                            size={16}
                            className="shrink-0 mr-1.5"
                        />
                    )}

                    {/* Label / Input */}
                    {isEditing ? (
                        <div
                            className="flex-1 flex items-center gap-1 min-w-0"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <Input
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') confirmEdit();
                                    if (e.key === 'Escape') cancelEdit();
                                }}
                                autoFocus
                                className="h-6 text-xs px-1 py-0"
                            />
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={confirmEdit}
                                className="h-6 w-6"
                            >
                                <Check className="w-3 h-3" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={cancelEdit}
                                className="h-6 w-6"
                            >
                                <X className="w-3 h-3" />
                            </Button>
                        </div>
                    ) : (
                        <div className="flex-1 truncate min-w-0 font-normal">
                            {renderLabel ? renderLabel(node) : node.name}
                        </div>
                    )}

                    {/* Inline Actions (hover) */}
                    {!isEditing && actions && actions.length > 0 && (
                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                            {actions.map((action, i) => {
                                const visible = action.visible
                                    ? action.visible(node)
                                    : true;
                                if (!visible) return null;
                                const Icon = action.icon;
                                return (
                                    <Button
                                        key={i}
                                        variant="ghost"
                                        size="icon-sm"
                                        className={cn(
                                            'h-6 w-6 text-muted-foreground',
                                            action.variant === 'destructive' &&
                                                'text-destructive hover:text-destructive',
                                        )}
                                        title={action.label}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            action.onClick(node, context);
                                        }}
                                    >
                                        <Icon className="w-3.5 h-3.5" />
                                    </Button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* End Content (Predictions, etc) - Outside padding */}
                {renderEndContent && (
                    <div className="shrink-0 flex items-center">
                        {renderEndContent(node)}
                    </div>
                )}
            </div>

            {isExpanded && node.children && node.children.length > 0 && (
                <div className="border-l border-border/40 ml-[18px] pl-[1px]">
                    {node.children.map((child) => (
                        <TreeItem
                            key={child.id}
                            node={child}
                            depth={depth + 1}
                            expandedIds={expandedIds}
                            onToggle={onToggle}
                            selectedIds={selectedIds}
                            indeterminateIds={indeterminateIds}
                            onSelect={onSelect}
                            selectionMode={selectionMode}
                            renderLabel={renderLabel}
                            renderStartIcon={renderStartIcon}
                            renderEndContent={renderEndContent}
                            actions={actions}
                            editable={editable}
                            onRename={onRename}
                            getRowClassName={getRowClassName}
                        />
                    ))}
                </div>
            )}

            {/* Empty Folder State */}
            {isExpanded &&
                node.type === 'folder' &&
                (!node.children || node.children.length === 0) &&
                !node.isLoading && (
                    <div className="text-xs text-muted-foreground italic py-1 pl-8">
                        Empty
                    </div>
                )}
        </div>
    );
}
