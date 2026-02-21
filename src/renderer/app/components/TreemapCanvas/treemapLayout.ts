import { hierarchy, treemap, treemapSquarify } from 'd3-hierarchy';
import type { HierarchyRectangularNode } from 'd3-hierarchy';
import type { Node } from '../../zoomData';

export type TreemapNode = HierarchyRectangularNode<Node>;

export function calculateTreemap(
    root: Node,
    width: number,
    height: number
): TreemapNode {
    const h = hierarchy(root)
        .sum((d) => {
            // Count leaf nodes (no children or empty children array)
            const isLeaf = !d.children || d.children.length === 0;
            return isLeaf ? 1 : 0;
        })
        .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    const layout = treemap<Node>()
        .size([width, height])
        .paddingOuter(12)
        .paddingInner(8)
        .paddingTop(20)
        .tile(treemapSquarify)
        .round(true);

    return layout(h);
}

export function findNodeById(
    root: TreemapNode,
    id: string
): TreemapNode | null {
    if (root.data.id === id) return root;
    for (const child of root.children ?? []) {
        const found = findNodeById(child, id);
        if (found) return found;
    }
    return null;
}

export function getAncestors(node: TreemapNode): TreemapNode[] {
    const ancestors: TreemapNode[] = [];
    let current: TreemapNode | null = node;
    while (current) {
        ancestors.unshift(current);
        current = current.parent;
    }
    return ancestors;
}
