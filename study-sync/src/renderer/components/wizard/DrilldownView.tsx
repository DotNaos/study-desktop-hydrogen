import { Button, Checkbox } from '@aryazos/ui/shadcn';
import {
    Ban,
    Check,
    ChevronLeft,
    Folder,
    Search,
    X as XIcon,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { IgnoreDialog } from './IgnoreDialog';
import { SearchModal } from './SearchModal';
import { Tree, type TreeNode } from './Tree';
import { FileExtensionIcon } from './fileIcons';
import {
    IgnoreRule,
    LocalStackItem,
    LocalTreeNode,
    PredictionResult,
    SearchModalState,
} from './types';
import { useIgnoreRules } from './useIgnoreRules';

type DrilldownViewProps = {
    selectedItem: LocalStackItem;
    scan: {
        folders: string[];
        files: { relativePath: string; name: string }[];
    };
    mappings: Map<string, string>;
    predictions: Record<string, PredictionResult[]>;
    ignoreRules: IgnoreRule[];
    onBack: () => void;
    onAcceptPrediction: (localPath: string, remoteId: string) => void;
    onAddIgnoreRule: (rule: any) => void;
    fetchPredictions: (name: string, parentRemoteId?: string) => void;
};

export function DrilldownView({
    selectedItem,
    scan,
    mappings,
    predictions,
    ignoreRules,
    onBack,
    onAcceptPrediction,
    onAddIgnoreRule,
    fetchPredictions,
}: DrilldownViewProps) {
    const [expandedLocal, setExpandedLocal] = useState<Set<string>>(new Set());
    const [showResolved, setShowResolved] = useState(false);
    const [showIgnoreDialog, setShowIgnoreDialog] = useState(false);
    const [ignoreTarget, setIgnoreTarget] = useState<{
        path: string;
        name: string;
        isFolder: boolean;
    } | null>(null);
    const [searchModal, setSearchModal] = useState<SearchModalState>({
        open: false,
        localPath: '',
        localName: '',
    });

    const { isPathIgnored } = useIgnoreRules(ignoreRules);

    // Build local tree
    const localTree = useMemo((): LocalTreeNode | null => {
        const rootPath = selectedItem.path;

        const buildNode = (
            path: string,
            name: string,
            isFolder: boolean,
        ): LocalTreeNode => {
            const children: LocalTreeNode[] = [];

            if (isFolder) {
                for (const folder of scan.folders) {
                    if (folder.startsWith(path + '/')) {
                        const relativePath = folder.substring(path.length + 1);
                        if (!relativePath.includes('/')) {
                            children.push(
                                buildNode(folder, relativePath, true),
                            );
                        }
                    }
                }
                for (const file of scan.files) {
                    if (file.relativePath.startsWith(path + '/')) {
                        const relativePath = file.relativePath.substring(
                            path.length + 1,
                        );
                        if (!relativePath.includes('/')) {
                            children.push(
                                buildNode(file.relativePath, file.name, false),
                            );
                        }
                    }
                }
            }

            children.sort((a, b) => {
                if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
                return a.name.localeCompare(b.name);
            });

            const ignored = isPathIgnored(path, name);
            let resolved = !!mappings.get(path);

            if (!resolved && isFolder && children.length > 0) {
                resolved = children.every((c) => c.resolved || c.ignored);
            }

            return {
                path,
                name,
                isFolder,
                resolved,
                ignored,
                children,
            };
        };

        return buildNode(rootPath, selectedItem.name, selectedItem.isFolder);
    }, [selectedItem, scan, mappings, isPathIgnored]);

    // Auto-expand root
    useEffect(() => {
        if (localTree && !expandedLocal.has(localTree.path)) {
            setExpandedLocal(new Set([localTree.path]));
        }
    }, [localTree]); // Only run when tree structure is initialized

    // Prediction fetching logic
    // We need to fetch predictions for visible nodes.
    // With Tree component, we don't have a simple flat list of visible nodes unless we traverse.
    // But we can fetch aggressively or lazily.
    // Let's replicate the effect: fetch for all nodes in the tree (it's usually small enough for drilldown).
    // Or traverse expanded nodes.
    useEffect(() => {
        if (!localTree) return;
        const traverse = (node: LocalTreeNode) => {
            // Only fetch if not resolved and no predictions yet
            if (!node.resolved && !predictions[node.name]) {
                let parentRemoteId: string | undefined;
                const lastSlashIndex = node.path.lastIndexOf('/');
                if (lastSlashIndex !== -1) {
                    const parentPath = node.path.substring(0, lastSlashIndex);
                    parentRemoteId = mappings.get(parentPath);
                }
                fetchPredictions(node.name, parentRemoteId);
            }
            // If folder is expanded (or always if we want to prefetch), recurse.
            // Drilldown is usually scoped, so fetching all children is probably fine.
            // Or check expandedLocal.
            if (
                node.children &&
                (expandedLocal.has(node.path) || node.path === localTree.path)
            ) {
                node.children.forEach(traverse);
            }
        };
        traverse(localTree);
    }, [localTree, expandedLocal, predictions, fetchPredictions, mappings]);

    // Convert to generic TreeNode
    const treeData = useMemo(() => {
        if (!localTree) return [];

        const mapNode = (node: LocalTreeNode): TreeNode<LocalTreeNode> => {
            // Should hide?
            // Original logic: (node.resolved || node.ignored) && depth > 0 && !showResolved;
            // We can't easily check depth here without recursion arg, but we can pass it.
            // Actually, easiest to filter children.

            const children = node.children.map(mapNode).filter((child) => {
                if (showResolved) return true;
                // Hide resolved/ignored children
                return !child.data!.resolved && !child.data!.ignored;
            });

            return {
                id: node.path,
                name: node.name,
                type: node.isFolder ? 'folder' : 'file',
                data: node,
                children: children,
                // We need to ensure we return a valid node even if children are hidden?
                // Yes, the node itself is returned. Filtering happens at parent level.
            };
        };

        return [mapNode(localTree)];
    }, [localTree, showResolved]);

    const handleOpenSearch = (localPath: string, localName: string) => {
        setSearchModal({ open: true, localPath, localName });
    };

    const handleAcceptRemote = (nodeId: string) => {
        onAcceptPrediction(searchModal.localPath, nodeId);
        setSearchModal({ open: false, localPath: '', localName: '' });
    };

    const handleIgnore = (node: LocalTreeNode) => {
        setIgnoreTarget({
            path: node.path,
            name: node.name,
            isFolder: node.isFolder,
        });
        setShowIgnoreDialog(true);
    };

    const handleIgnoreSubmit = (rule: any) => {
        onAddIgnoreRule(rule);
        setShowIgnoreDialog(false);
        setIgnoreTarget(null);
    };

    // Render prediction column
    const renderPrediction = (node: TreeNode<LocalTreeNode>) => {
        const localNode = node.data!;
        if (localNode.ignored) {
            return (
                <div className="flex items-center gap-2 px-3 text-sm text-muted-foreground opacity-50">
                    <Ban className="w-4 h-4" />
                    <span className="italic">Ignored</span>
                </div>
            );
        }
        if (localNode.resolved) {
            return (
                <div className="px-3 text-sm text-muted-foreground opacity-60">
                    ✓ Mapped
                </div>
            );
        }

        const nodePredictions = predictions[localNode.name] || [];
        const topPrediction = nodePredictions[0];

        if (!topPrediction) {
            return (
                <div className="flex items-center px-3 gap-2 w-full">
                    <span className="flex-1 text-sm text-muted-foreground italic">
                        No match
                    </span>
                    <div className="flex items-center gap-1 opacity-100 transition-opacity">
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleOpenSearch(
                                    localNode.path,
                                    localNode.name,
                                );
                            }}
                            className="h-7 w-7"
                        >
                            <Search className="w-4 h-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleIgnore(localNode);
                            }}
                            className="h-7 w-7"
                        >
                            <XIcon className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            );
        }

        const displayName =
            topPrediction.fileExtension &&
            !topPrediction.remoteName
                .toLowerCase()
                .endsWith(`.${topPrediction.fileExtension.toLowerCase()}`)
                ? `${topPrediction.remoteName}.${topPrediction.fileExtension}`
                : topPrediction.remoteName;

        return (
            <div className="flex items-center px-3 gap-2 w-full overflow-hidden">
                {topPrediction.type === 'folder' ? (
                    <Folder className="w-4 h-4 text-blue-500 shrink-0" />
                ) : (
                    <FileExtensionIcon
                        extension={topPrediction.fileExtension}
                        size={16}
                        className="shrink-0"
                    />
                )}
                <span className="flex-1 text-sm truncate" title={displayName}>
                    {displayName}
                </span>

                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={(e) => {
                            e.stopPropagation();
                            onAcceptPrediction(
                                localNode.path,
                                topPrediction.remoteId,
                            );
                        }}
                        className="text-primary h-7 w-7"
                    >
                        <Check className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleOpenSearch(localNode.path, localNode.name);
                        }}
                        className="h-7 w-7"
                    >
                        <Search className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleIgnore(localNode);
                        }}
                        className="h-7 w-7"
                    >
                        <XIcon className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-background">
            <div className="flex items-center gap-3 px-3 py-2 border-b border-border bg-muted/30">
                <Button variant="ghost" size="icon-sm" onClick={onBack}>
                    <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="flex-1">
                    <h1 className="text-sm font-medium">
                        Mapping: {selectedItem.name}
                    </h1>
                </div>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                    <Checkbox
                        checked={showResolved}
                        onCheckedChange={(checked) =>
                            setShowResolved(checked === true)
                        }
                    />
                    Show resolved
                </label>
            </div>

            {/* Grid Header */}
            <div className="grid grid-cols-2 border-b border-border bg-muted/20 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <div className="px-3 py-1.5 pl-4">Local Files</div>
                <div className="px-3 py-1.5">Predictions</div>
            </div>

            <div className="flex-1 overflow-y-auto">
                <Tree<LocalTreeNode>
                    data={treeData}
                    expandedIds={expandedLocal}
                    onExpand={(node) =>
                        setExpandedLocal((prev) => new Set(prev).add(node.id))
                    }
                    onCollapse={(node) =>
                        setExpandedLocal((prev) => {
                            const next = new Set(prev);
                            next.delete(node.id);
                            return next;
                        })
                    }
                    getRowClassName={(node) =>
                        `grid grid-cols-2 border-b border-border/40 items-center ${node.data!.ignored ? 'opacity-50' : ''}`
                    }
                    renderLabel={(node) => node.name}
                    // Icon is handled by helper in Tree if we don't pass renderStartIcon,
                    // but we want specific FileExtension logic if possible,
                    // Generic Tree handles Folder vs FileExtensionIcon nicely already!
                    // We can rely on default or pass specific.

                    renderEndContent={renderPrediction}
                />
            </div>

            <SearchModal
                open={searchModal.open}
                localPath={searchModal.localPath}
                localName={searchModal.localName}
                onClose={() =>
                    setSearchModal({
                        open: false,
                        localPath: '',
                        localName: '',
                    })
                }
                onSelect={handleAcceptRemote}
            />

            {showIgnoreDialog && ignoreTarget && (
                <IgnoreDialog
                    localName={ignoreTarget.name}
                    localPath={ignoreTarget.path}
                    isFolder={ignoreTarget.isFolder}
                    fileExtension={ignoreTarget.name.split('.').pop()}
                    onSubmit={handleIgnoreSubmit}
                    onClose={() => {
                        setShowIgnoreDialog(false);
                        setIgnoreTarget(null);
                    }}
                />
            )}
        </div>
    );
}
