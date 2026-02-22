export interface ExplorerNode {
    id: string;
    name: string;
    type?: string;
    progress?: number;
    isCompleted?: boolean;
    children?: ExplorerNode[];
}

export function isFolderNode(node: ExplorerNode): boolean {
    return node.type === 'folder' || node.type === 'composite';
}

export function isResourceNode(node: ExplorerNode): boolean {
    return !isFolderNode(node);
}

export function getNodeCompletionValue(
    node: ExplorerNode,
    completionMap: Map<string, boolean>,
): boolean {
    if (isResourceNode(node)) {
        if (completionMap.has(node.id)) {
            return completionMap.get(node.id) === true;
        }
        if (typeof node.progress === 'number') {
            return Math.round(node.progress) >= 100;
        }
        return node.isCompleted === true;
    }

    const children = node.children ?? [];
    const resourceChildren = children.filter((child) => isResourceNode(child));
    const folderChildren = children.filter((child) => isFolderNode(child));

    const hasAnyDescendants =
        resourceChildren.length > 0 || folderChildren.length > 0;
    if (!hasAnyDescendants) {
        return false;
    }

    const resourcesComplete = resourceChildren.every((child) =>
        getNodeCompletionValue(child, completionMap),
    );
    const foldersComplete = folderChildren.every((child) =>
        getNodeCompletionValue(child, completionMap),
    );

    return resourcesComplete && foldersComplete;
}

export function collectResourceIds(node: ExplorerNode): string[] {
    if (isResourceNode(node)) {
        return [node.id];
    }

    const result: string[] = [];
    for (const child of node.children ?? []) {
        result.push(...collectResourceIds(child));
    }
    return result;
}

export function collectAllIds(node: ExplorerNode): string[] {
    const result: string[] = [node.id];
    for (const child of node.children ?? []) {
        result.push(...collectAllIds(child));
    }
    return result;
}

export function flattenNodes(nodes: ExplorerNode[]): ExplorerNode[] {
    const result: ExplorerNode[] = [];

    const visit = (node: ExplorerNode): void => {
        result.push(node);
        for (const child of node.children ?? []) {
            visit(child);
        }
    };

    for (const node of nodes) {
        visit(node);
    }

    return result;
}

export function buildInitialCompletionMap(
    nodes: ExplorerNode[],
): Map<string, boolean> {
    const map = new Map<string, boolean>();
    for (const node of flattenNodes(nodes)) {
        if (!isResourceNode(node)) {
            continue;
        }
        if (typeof node.progress === 'number') {
            map.set(node.id, Math.round(node.progress) >= 100);
            continue;
        }
        if (typeof node.isCompleted === 'boolean') {
            map.set(node.id, node.isCompleted);
        }
    }
    return map;
}
