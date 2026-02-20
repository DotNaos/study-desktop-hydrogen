import { createLogger } from '@aryazos/ts-base/logging';
import { Button, Checkbox, Input } from '@aryazos/ui/shadcn';
import {
    Check,
    Download,
    EyeOff,
    Folder,
    Globe,
    Loader2,
    RefreshCw,
    Search,
    X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { DownloadDestinationDialog } from './DownloadDestinationDialog';
import { Tree, type TreeNode } from './Tree';
import { FileIcon } from './fileIcons';
import { EnrichedRemoteNode, IgnoreRule, RemoteNode } from './types';
import { useRemoteStack } from './useRemoteStack';

const logger = createLogger('com.aryazos.study-sync.renderer.wizard.remote-stack');

type RemoteStackPanelProps = {
    mappings: Map<string, string>;
    ignoreRules: IgnoreRule[];
    onDownload?: (node: EnrichedRemoteNode) => void;
    onDownloadComplete?: () => Promise<void> | void;
    onIgnore?: (item: {
        path: string;
        name: string;
        isFolder: boolean;
    }) => void;
};

export function RemoteStackPanel({
    mappings,
    ignoreRules,
    onDownload,
    onDownloadComplete,
    onIgnore,
}: RemoteStackPanelProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [showResolved, setShowResolved] = useState(false);
    const [downloadNode, setDownloadNode] = useState<EnrichedRemoteNode | null>(
        null,
    );
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const getApiBase = () => {
        const port =
            new URLSearchParams(window.location.search).get('port') || '3333';
        return `http://localhost:${port}/api`;
    };

    const mappingList = useMemo(
        () =>
            Array.from(mappings.entries()).map(([path, id]) => ({
                remoteId: id,
                relativePath: path,
            })),
        [mappings],
    );

    const {
        nodes,
        loading,
        error,
        expanded,
        loadedChildren,
        loadingNodes,
        fetchRoots,
        toggleExpand,
        getEnrichedNode,
        getNode,
    } = useRemoteStack(getApiBase(), mappingList, ignoreRules);

    useEffect(() => {
        fetchRoots();
    }, [fetchRoots]);

    const getNodeExtension = (node: TreeNode<EnrichedRemoteNode>) => {
        if (node.type !== 'file') return undefined;
        const rawExtension = node.data?.fileExtension?.trim();
        if (rawExtension) return rawExtension.replace(/^\./, '');
        const nameParts = node.name.split('.');
        return nameParts.length > 1
            ? nameParts[nameParts.length - 1]
            : undefined;
    };

    const getDisplayName = (node: TreeNode<EnrichedRemoteNode>) => {
        if (node.type !== 'file') return node.name;
        const extension = getNodeExtension(node);
        if (!extension) return node.name;
        const normalized = extension.toLowerCase();
        const suffix = `.${normalized}`;
        const lowerName = node.name.toLowerCase();
        return lowerName.endsWith(suffix)
            ? node.name
            : `${node.name}.${extension}`;
    };

    const treeData = useMemo(() => {
        const isNodeResolved = (node: EnrichedRemoteNode) =>
            node.status === 'mapped' || node.status === 'ignored';

        const areChildrenFullyResolved = (node: RemoteNode): boolean => {
            const rawChildren = loadedChildren.get(node.id) ?? node.children;
            if (!rawChildren) return false;
            if (rawChildren.length === 0) return true;

            return rawChildren.every((child) => {
                const childEnriched = getEnrichedNode(child);
                if (!isNodeResolved(childEnriched)) return false;
                if (child.type === 'file') return true;
                return areChildrenFullyResolved(child);
            });
        };

        const buildTree = (
            remoteNodes: RemoteNode[],
        ): TreeNode<EnrichedRemoteNode>[] => {
            return remoteNodes
                .map((node) => {
                    const enriched = getEnrichedNode(node);
                    const rawChildren =
                        loadedChildren.get(node.id) ?? node.children ?? [];
                    const children = buildTree(rawChildren).filter(
                        Boolean,
                    ) as TreeNode<EnrichedRemoteNode>[];

                    const isResolved = isNodeResolved(enriched);
                    const shouldHideResolvedFolder =
                        node.type !== 'file' &&
                        isResolved &&
                        areChildrenFullyResolved(node);
                    const shouldHideResolved =
                        node.type === 'file'
                            ? isResolved
                            : shouldHideResolvedFolder;

                    // If not showing resolved, hide ONLY if:
                    // 1. It IS resolved
                    // 2. AND it has no unresolved children
                    // If a mapped folder has unresolved children, we MUST show it.
                    if (!showResolved && shouldHideResolved) {
                        return null;
                    }

                    return {
                        id: node.id,
                        name: node.name,
                        type: node.type === 'file' ? 'file' : 'folder',
                        data: enriched,
                        children: children,
                        isLoading: loadingNodes.has(node.id),
                        isLoaded:
                            loadedChildren.has(node.id) || !!node.children,
                    };
                })
                .filter((n): n is TreeNode<EnrichedRemoteNode> => n !== null);
        };

        let roots = nodes;
        if (searchQuery) {
            roots = roots.filter((n) =>
                n.name.toLowerCase().includes(searchQuery.toLowerCase()),
            );
        }
        return buildTree(roots);
    }, [
        nodes,
        loadedChildren,
        loadingNodes,
        getEnrichedNode,
        showResolved,
        searchQuery,
    ]);

    const indeterminateIds = useMemo(() => {
        const set = new Set<string>();
        if (selectedIds.size === 0) return set;

        const traverse = (nodes: TreeNode<EnrichedRemoteNode>[]) => {
            for (const node of nodes) {
                if (node.children && node.children.length > 0) {
                    traverse(node.children);
                    const childIds = node.children.map((c) => c.id);
                    const directSelected = childIds.filter((id) =>
                        selectedIds.has(id),
                    ).length;
                    const indeterminateChildren = childIds.filter((id) =>
                        set.has(id),
                    ).length;

                    if (
                        (directSelected > 0 &&
                            directSelected < childIds.length) ||
                        indeterminateChildren > 0
                    ) {
                        set.add(node.id);
                    }
                }
            }
        };
        traverse(treeData);
        return set;
    }, [treeData, selectedIds]);

    const handleDownloadRequest = (node: EnrichedRemoteNode) => {
        if (onDownload) onDownload(node);
        else setDownloadNode(node);
    };

    const confirmDownload = async (destinationPath: string) => {
        if (!downloadNode) return;
        try {
            const response = await fetch(
                `${getApiBase()}/export/download-recursive`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        remoteId: downloadNode.id,
                        relativePath: destinationPath,
                    }),
                },
            );
            if (!response.ok) throw new Error(await response.text());
            await fetchRoots();
            await onDownloadComplete?.();
        } catch (err) {
            logger.error('Download error', {
                error: err,
                remoteId: downloadNode.id,
            });
        } finally {
            setDownloadNode(null);
        }
    };

    const handleSelect = (node: TreeNode<EnrichedRemoteNode>) => {
        const nodeId = node.id;
        const next = new Set(selectedIds);
        const isSelected = next.has(nodeId);

        const getAllDescendantIds = (rootId: string): string[] => {
            const res: string[] = [];
            const children =
                loadedChildren.get(rootId) || getNode(rootId)?.children || [];
            for (const child of children) {
                res.push(child.id);
                if (child.children) {
                    child.children.forEach((c) => res.push(c.id));
                }
                res.push(...getAllDescendantIds(child.id));
            }
            return res;
        };

        const descendants = getAllDescendantIds(nodeId);

        if (isSelected) {
            next.delete(nodeId);
            descendants.forEach((id) => next.delete(id));
        } else {
            next.add(nodeId);
            descendants.forEach((id) => next.add(id));

            let current = getNode(nodeId);
            while (current?.parent && current.parent !== 'root') {
                const p = getNode(current.parent);
                if (!p) break;
                next.add(p.id);
                current = p;
            }
        }
        setSelectedIds(next);
    };

    const handleBulkDownload = async () => {
        const idsToDownload = Array.from(selectedIds);
        const concurrency = 3;
        let activeCount = 0;
        let index = 0;
        const executing: Promise<void>[] = [];

        while (index < idsToDownload.length || executing.length > 0) {
            while (activeCount < concurrency && index < idsToDownload.length) {
                const id = idsToDownload[index++];
                activeCount++;
                const task = (async () => {
                    try {
                        const node = getNode(id);
                        if (node) {
                            let skip = false;
                            let check = node;
                            while (check.parent && check.parent !== 'root') {
                                if (selectedIds.has(check.parent)) {
                                    skip = true;
                                    break;
                                }
                                const p = getNode(check.parent);
                                if (!p) break;
                                check = p;
                            }

                            if (!skip) {
                                const parts = [node.name];
                                let current = node;
                                while (
                                    current.parent &&
                                    current.parent !== 'root'
                                ) {
                                    const p = getNode(current.parent);
                                    if (!p) break;
                                    parts.unshift(p.name);
                                    current = p;
                                }

                                await fetch(
                                    `${getApiBase()}/export/download-recursive`,
                                    {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json',
                                        },
                                        body: JSON.stringify({
                                            remoteId: id,
                                            relativePath: parts.join('/'),
                                        }),
                                    },
                                );
                                await new Promise((r) => setTimeout(r, 500));
                            }
                        }
                    } catch (e) {
                        logger.error('Bulk download error', { error: e, id });
                    } finally {
                        activeCount--;
                    }
                })();
                executing.push(task);
                task.then(() => executing.splice(executing.indexOf(task), 1));
            }
            if (executing.length > 0) await Promise.race(executing);
        }
        await fetchRoots();
        await onDownloadComplete?.();
        setSelectedIds(new Set());
    };

    const handleBulkIgnore = () => {
        if (!onIgnore) return;
        selectedIds.forEach((id) => {
            const node = getNode(id);
            if (node) {
                onIgnore({
                    path: '',
                    name: node.name,
                    isFolder: node.type !== 'file',
                });
            }
        });
        setSelectedIds(new Set());
    };

    return (
        <div className="flex flex-col h-full bg-background relative">
            <div className="px-3 py-2 border-b border-border bg-muted/30 flex items-center gap-3">
                <div className="shrink-0">
                    <h2 className="text-sm font-medium">Remote Explorer</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Browse Moodle resources
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-1">
                    <div className="flex items-center gap-2 mr-2">
                        <Checkbox
                            id="show-resolved"
                            checked={showResolved}
                            onCheckedChange={(c) => setShowResolved(!!c)}
                        />
                        <label
                            htmlFor="show-resolved"
                            className="text-xs text-muted-foreground whitespace-nowrap cursor-pointer select-none"
                        >
                            Show Resolved
                        </label>
                    </div>

                    <div className="relative flex-1">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Filter..."
                            className="h-8 pl-8 text-xs bg-background w-full"
                        />
                    </div>
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={fetchRoots}
                        disabled={loading}
                        title="Refresh"
                    >
                        <RefreshCw
                            className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
                        />
                    </Button>
                </div>
            </div>

            {error ? (
                <div className="p-4 text-destructive flex items-center gap-2 text-sm">
                    Error: {error}
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto overflow-x-hidden">
                    {loading && nodes.length === 0 && (
                        <div className="flex justify-center p-8">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                    )}

                    {!loading && nodes.length === 0 && !error && (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
                            <Globe className="w-12 h-12 mb-3 opacity-40" />
                            <p className="text-sm">No remote nodes found</p>
                        </div>
                    )}

                    <Tree<EnrichedRemoteNode>
                        data={treeData}
                        expandedIds={expanded}
                        onExpand={(node) => toggleExpand(node.data!)}
                        onCollapse={(node) => toggleExpand(node.data!)}
                        selectedIds={selectedIds}
                        indeterminateIds={indeterminateIds}
                        onSelect={(node) => handleSelect(node)}
                        selectionMode="checkbox"
                        renderStartIcon={(node) =>
                            node.type === 'folder' ? (
                                <Folder className="w-4 h-4 mr-1 text-blue-500" />
                            ) : (
                                <FileIcon
                                    filename={getDisplayName(node)}
                                    className="mr-1 text-[16px]"
                                />
                            )
                        }
                        renderLabel={(node) => getDisplayName(node)}
                        renderEndContent={(node) => (
                            <div className="flex items-center gap-1">
                                {node.data?.status === 'mapped' && (
                                    <Check className="w-4 h-4 text-primary" />
                                )}
                                {node.data?.status === 'ignored' && (
                                    <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                                )}
                            </div>
                        )}
                        getRowClassName={(node) => {
                            const base = 'w-full min-w-0';
                            if (node.data?.status === 'ignored')
                                return `${base} opacity-50`;
                            if (node.data?.status === 'mapped')
                                return `${base} text-blue-600 dark:text-blue-400 font-medium`;
                            return base;
                        }}
                        actions={[
                            {
                                icon: Download,
                                label: 'Download',
                                onClick: (node) =>
                                    handleDownloadRequest(node.data!),
                                visible: (node) =>
                                    !['mapped', 'ignored'].includes(
                                        node.data?.status || '',
                                    ),
                            },
                        ]}
                    />
                </div>
            )}

            {selectedIds.size > 0 && (
                <div className="p-3 border-t border-border bg-background flex items-center justify-between gap-3 shadow-lg">
                    <div className="text-sm font-medium text-muted-foreground">
                        {selectedIds.size} selected
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedIds(new Set())}
                            title="Clear Selection"
                        >
                            <X className="w-4 h-4" />
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            title="Ignore Selected"
                            onClick={handleBulkIgnore}
                        >
                            <EyeOff className="w-4 h-4 mr-2" />
                            Ignore
                        </Button>
                        <Button
                            size="sm"
                            title="Download Selected"
                            onClick={handleBulkDownload}
                        >
                            <Download className="w-4 h-4 mr-2" />
                            Download
                        </Button>
                    </div>
                </div>
            )}

            <DownloadDestinationDialog
                open={!!downloadNode}
                onOpenChange={(open) => !open && setDownloadNode(null)}
                node={downloadNode}
                onConfirm={confirmDownload}
            />
        </div>
    );
}
