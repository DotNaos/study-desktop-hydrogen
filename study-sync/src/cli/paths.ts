import type { SyncNode } from '@aryazos/study/types';
import { listChildren, listRootNodes } from '../main/services/studySyncService';

export type PathResolutionIssue = 'not_found' | 'ambiguous';

export class PathResolutionError extends Error {
    issue: PathResolutionIssue;
    segment: string;
    matches: SyncNode[];

    constructor(
        issue: PathResolutionIssue,
        segment: string,
        matches: SyncNode[],
    ) {
        const message =
            issue === 'ambiguous'
                ? `Ambiguous match for "${segment}"`
                : `No match for "${segment}"`;
        super(message);
        this.issue = issue;
        this.segment = segment;
        this.matches = matches;
    }
}

export function parseNodePath(input: string | undefined): string[] {
    if (!input) return [];
    return input
        .split('/')
        .map((segment) => segment.trim())
        .filter((segment) => segment.length > 0);
}

function findMatches(nodes: SyncNode[], segment: string): SyncNode[] {
    const idMatches = nodes.filter((node) => node.id === segment);
    if (idMatches.length > 0) {
        return idMatches;
    }

    const matches = filterNodes(nodes, segment.toLowerCase());
    if (matches.length > 0) return matches;

    // Fallback: try replacing underscores with spaces
    return filterNodes(nodes, segment.toLowerCase().replace(/_/g, ' '));
}

function filterNodes(nodes: SyncNode[], lower: string): SyncNode[] {
    return nodes.filter((node) => {
        const name = node.name.toLowerCase();
        if (name === lower) return true;
        const ext = node.fileExtension?.trim().replace(/^\./, '');
        if (!ext) return false;
        return `${name}.${ext.toLowerCase()}` === lower;
    });
}

export interface ResolvedPath {
    node: SyncNode;
    children: SyncNode[];
}

export interface ResolvedNodePath {
    node: SyncNode;
    nodes: SyncNode[];
}

function isFolderLike(node: SyncNode): boolean {
    return node.type === 'folder' || node.type === 'composite';
}

export async function resolveNodeByPath(
    segments: string[],
    includeGroups: boolean = true,
): Promise<ResolvedPath> {
    let children = await listRootNodes(includeGroups);
    let current: SyncNode | undefined;

    for (const segment of segments) {
        const matches = findMatches(children, segment);
        if (matches.length === 0) {
            throw new PathResolutionError('not_found', segment, []);
        }
        if (matches.length > 1) {
            throw new PathResolutionError('ambiguous', segment, matches);
        }

        current = matches[0];
        children = await listChildren(current.id, includeGroups);
    }

    if (!current) {
        throw new PathResolutionError('not_found', '', []);
    }

    return { node: current, children };
}

export async function listNodesAtPath(
    segments: string[],
    includeGroups: boolean = true,
): Promise<{ node: SyncNode | null; children: SyncNode[] }> {
    if (segments.length === 0) {
        return { node: null, children: await listRootNodes(includeGroups) };
    }

    const resolved = await resolveNodeByPath(segments, includeGroups);
    return { node: resolved.node, children: resolved.children };
}

export async function resolveNodesByPattern(
    segments: string[],
): Promise<ResolvedNodePath[]> {
    if (segments.length === 0) {
        return [];
    }

    let contexts: Array<{
        node: SyncNode | null;
        nodes: SyncNode[];
        children: SyncNode[];
    }> = [{ node: null, nodes: [], children: await listRootNodes() }];

    for (let index = 0; index < segments.length; index += 1) {
        const segment = segments[index];
        const isWildcard = segment === '*';
        const nextContexts: Array<{
            node: SyncNode;
            nodes: SyncNode[];
            children: SyncNode[];
        }> = [];

        for (const context of contexts) {
            let matches = context.children;
            if (!isWildcard) {
                matches = findMatches(context.children, segment);
                if (matches.length === 0) {
                    continue;
                }
                if (matches.length > 1) {
                    throw new PathResolutionError(
                        'ambiguous',
                        segment,
                        matches,
                    );
                }
            }

            for (const match of matches) {
                const nodes = [...context.nodes, match];
                let children: SyncNode[] = [];
                if (index < segments.length - 1) {
                    if (!isFolderLike(match)) {
                        continue;
                    }
                    children = await listChildren(match.id);
                }
                nextContexts.push({ node: match, nodes, children });
            }
        }

        if (nextContexts.length === 0) {
            throw new PathResolutionError('not_found', segment, []);
        }

        contexts = nextContexts;
    }

    return contexts.map((context) => ({
        node: context.node!,
        nodes: context.nodes,
    }));
}
