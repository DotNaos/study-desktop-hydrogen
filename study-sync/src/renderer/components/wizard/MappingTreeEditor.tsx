import { Checkbox } from '@aryazos/ui/shadcn';
import { Ban, Folder, Link, Pencil, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Tree, type TreeAction, type TreeNode } from './Tree';
import { FileExtensionIcon } from './fileIcons';

export type MappingTreeNode = {
    id: string;
    localPath: string;
    localName: string;
    remoteId: string;
    remoteName: string;
    isFolder: boolean;
    isIgnored?: boolean;
    children?: MappingTreeNode[];
};

type MappingTreeEditorProps = {
    mappings: MappingTreeNode[];
    onRename: (localPath: string, newName: string) => void;
    onRemove: (localPath: string) => void;
    onDownload: (remoteId: string, localPath: string) => void;
};

export function MappingTreeEditor({
    mappings,
    onRename,
    onRemove,
    onDownload,
}: MappingTreeEditorProps) {
    const [showIgnored, setShowIgnored] = useState(false);

    // Convert MappingTreeNode to generic TreeNode
    // We need to filter recursively based on showIgnored
    const treeData = useMemo(() => {
        const mapNode = (
            node: MappingTreeNode,
        ): TreeNode<MappingTreeNode> | null => {
            // If ignored and not showing ignored, check if it has visible children
            // typically if a folder is ignored, children are ignored too.
            // But if a CHILD is explicitly mapped inside an ignored folder?
            // The scan logic usually handles this, but let's assume we show if IT is visible or HAS visible children.

            const children = node.children?.map(mapNode).filter(Boolean) as
                | TreeNode<MappingTreeNode>[]
                | undefined;
            const hasVisibleChildren = children && children.length > 0;

            const isVisible =
                !node.isIgnored || showIgnored || hasVisibleChildren;

            if (!isVisible) return null;

            return {
                id: node.id,
                name: node.localName,
                type: node.isFolder ? 'folder' : 'file',
                data: node,
                children: children,
            };
        };

        return mappings
            .map(mapNode)
            .filter((n): n is TreeNode<MappingTreeNode> => n !== null);
    }, [mappings, showIgnored]);

    const actions: TreeAction<MappingTreeNode>[] = [
        {
            icon: Pencil,
            label: 'Rename',
            onClick: (node, context) => context.startEdit(), // Use the context to trigger edit
            visible: (node) => !node.data?.isIgnored,
        },
        {
            icon: Trash2,
            label: 'Remove mapping',
            variant: 'destructive',
            onClick: (node) => onRemove(node.data!.localPath),
            visible: (node) => !node.data?.isIgnored,
        },
    ];

    if (mappings.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
                <Link className="w-12 h-12 mb-3 opacity-40" />
                <p className="text-sm font-medium">No mappings yet</p>
                <p className="text-xs mt-1">
                    Map local files to remote resources in the Local Stack tab
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-3 py-2 border-b border-border bg-muted/30 flex items-center justify-between">
                <div>
                    <h2 className="text-sm font-medium">Mapping Tree</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        {mappings.flat().length} items
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Checkbox
                        id="show-ignored"
                        checked={showIgnored}
                        onCheckedChange={(c) => setShowIgnored(!!c)}
                    />
                    <label
                        htmlFor="show-ignored"
                        className="text-xs text-muted-foreground cursor-pointer select-none"
                    >
                        Show ignored
                    </label>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto py-1">
                <Tree<MappingTreeNode>
                    data={treeData}
                    editable={true}
                    onRename={(node, newName) =>
                        onRename(node.data!.localPath, newName)
                    }
                    renderStartIcon={(node) =>
                        node.type === 'folder' ? (
                            <Folder className="w-4 h-4 text-blue-500 shrink-0 mr-1.5" />
                        ) : (
                            <FileExtensionIcon
                                extension={node.name.split('.').pop()}
                                size={16}
                                className="shrink-0 mr-1.5"
                            />
                        )
                    }
                    renderLabel={(node) => (
                        <div className="flex items-center gap-2 min-w-0 w-full overflow-hidden">
                            <span
                                className={`truncate shrink ${node.data?.isIgnored ? 'line-through text-muted-foreground' : ''}`}
                            >
                                {node.name}
                            </span>
                            {node.data?.isIgnored ? (
                                <span className="text-xs text-muted-foreground italic flex items-center gap-1 shrink-0">
                                    <Ban className="w-3 h-3" /> Ignored
                                </span>
                            ) : (
                                <span className="text-xs text-muted-foreground truncate opacity-70 shrink-0 max-w-[50%]">
                                    → {node.data?.remoteName}
                                </span>
                            )}
                        </div>
                    )}
                    getRowClassName={(node) =>
                        node.data?.isIgnored ? 'opacity-60' : ''
                    }
                    actions={actions}
                    className=""
                />
            </div>
        </div>
    );
}
