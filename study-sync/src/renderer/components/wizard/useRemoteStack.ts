import { createLogger } from '@aryazos/ts-base/logging';
import { useCallback, useState } from 'react';
import { EnrichedRemoteNode, RemoteNode } from './types';

const logger = createLogger('com.aryazos.study-sync.renderer.wizard.remote-stack');

export function useRemoteStack(
    apiBase: string,
    mappings: any[], // TODO: Type this properly from store types
    ignoreRules: any[],
) {
    const [nodes, setNodes] = useState<RemoteNode[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [loadedChildren, setLoadedChildren] = useState<
        Map<string, RemoteNode[]>
    >(new Map());
    const [loadingNodes, setLoadingNodes] = useState<Set<string>>(new Set());

    // Helper to checking if a node is ignored
    const isIgnored = useCallback(
        (name: string) => {
            // For now simple check, can use minimatch if needed
            // But `ignoreRules` are globs. We might need the matcher from useIgnoreRules logic?
            // Actually useIgnoreRules hook returns simple list.
            // We should probably rely on a shared matcher or simple regex check here.
            // Minimatch is a dependency.
            return ignoreRules.some((rule) => {
                // Simple exact match or extension match for now to match strict rules
                if (rule.pattern === name) return true;
                if (
                    rule.pattern.startsWith('*.') &&
                    name.endsWith(rule.pattern.slice(1))
                )
                    return true;
                // Basic glob support if users use it
                return false;
            });
        },
        [ignoreRules],
    );

    const fetchRoots = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${apiBase}/nodes`);
            if (!res.ok) throw new Error('Failed to fetch remote nodes');
            const data = await res.json();
            setNodes(data);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    }, [apiBase]);

    const fetchChildren = useCallback(
        async (nodeId: string) => {
            if (loadedChildren.has(nodeId) || loadingNodes.has(nodeId)) return;

            setLoadingNodes((prev) => new Set(prev).add(nodeId));
            try {
                const res = await fetch(
                    `${apiBase}/nodes/${encodeURIComponent(nodeId)}/children`,
                );
                if (res.ok) {
                    const children = await res.json();
                    setLoadedChildren((prev) =>
                        new Map(prev).set(nodeId, children),
                    );
                }
            } catch (err) {
                logger.error('Failed to fetch children', {
                    error: err,
                    nodeId,
                });
            } finally {
                setLoadingNodes((prev) => {
                    const next = new Set(prev);
                    next.delete(nodeId);
                    return next;
                });
            }
        },
        [apiBase, loadedChildren, loadingNodes],
    );

    const toggleExpand = useCallback(
        async (node: RemoteNode) => {
            const isExpanded = expanded.has(node.id);
            // Anything that's not a file is expandable
            if (!isExpanded && node.type !== 'file') {
                await fetchChildren(node.id);
            }
            setExpanded((prev) => {
                const next = new Set(prev);
                if (next.has(node.id)) next.delete(node.id);
                else next.add(node.id);
                return next;
            });
        },
        [expanded, fetchChildren],
    );

    // Compute enriched nodes for rendering
    // This needs to be recursive or done on the fly during render?
    // Ideally we return a helper to "enrich" a node.

    const getEnrichedNode = useCallback(
        (node: RemoteNode): EnrichedRemoteNode => {
            // Check if mapped directly
            const mapping = mappings.find((m) => m.remoteId === node.id);

            // Check if any ancestor is mapped?
            // This is hard without full tree parent pointers or iterating all mappings.
            // But we can check if the *parent* was passed down as mapped?
            // Actually, we can just return 'mapped' if THIS node is mapped.
            // If a parent is mapped, we might need to know that from the context when rendering.

            const status = mapping
                ? 'mapped'
                : isIgnored(node.name)
                  ? 'ignored'
                  : 'unmapped';

            return {
                ...node,
                status,
                localPath: mapping?.relativePath,
            };
        },
        [mappings, isIgnored],
    );

    // Maintain a flat map of all loaded nodes for easy lookup (e.g. for parent traversal)
    const [nodeMap, setNodeMap] = useState<Map<string, RemoteNode>>(new Map());

    // Update nodeMap when nodes or children change
    // This is a bit expensive to rebuild every time. Better to update incrementally or memoize?
    // For now, let's just expose a helper or rebuild it when data changes.
    // Actually, simpler: just use a ref or computed memo.
    const getNode = useCallback(
        (id: string) => {
            // Search roots
            const findIn = (list: RemoteNode[]): RemoteNode | undefined => {
                for (const n of list) {
                    if (n.id === id) return n;
                    if (n.children) {
                        const found = findIn(n.children);
                        if (found) return found;
                    }
                }
                return undefined;
            };

            let found = findIn(nodes);
            if (found) return found;

            // Search loaded children maps
            for (const children of loadedChildren.values()) {
                found = findIn(children);
                if (found) return found;
            }
            return undefined;
        },
        [nodes, loadedChildren],
    );

    return {
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
    };
}
