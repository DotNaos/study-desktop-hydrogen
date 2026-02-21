import { describe, expect, it } from 'vitest';
import {
    buildInitialCompletionMap,
    collectResourceIds,
    getNodeCompletionValue,
    type ExplorerNode,
} from './treeUtils';

const SAMPLE_TREE: ExplorerNode[] = [
    {
        id: 'semester-1',
        name: 'HS25',
        type: 'folder',
        children: [
            {
                id: 'course-1',
                name: 'Course A',
                type: 'folder',
                children: [
                    {
                        id: 'week-1',
                        name: 'Week 1',
                        type: 'folder',
                        children: [
                            {
                                id: 'resource-1',
                                name: 'Slides',
                                type: 'file',
                                progress: 100,
                            },
                            {
                                id: 'resource-2',
                                name: 'Worksheet',
                                type: 'file',
                                progress: 0,
                            },
                        ],
                    },
                ],
            },
        ],
    },
];

describe('treeUtils', () => {
    it('collects resource ids recursively', () => {
        const ids = collectResourceIds(SAMPLE_TREE[0]);
        expect(ids).toEqual(['resource-1', 'resource-2']);
    });

    it('builds initial completion map from progress', () => {
        const map = buildInitialCompletionMap(SAMPLE_TREE);
        expect(map.get('resource-1')).toBe(true);
        expect(map.get('resource-2')).toBe(false);
    });

    it('computes folder completion from descendant resources', () => {
        const map = buildInitialCompletionMap(SAMPLE_TREE);
        expect(getNodeCompletionValue(SAMPLE_TREE[0], map)).toBe(false);

        map.set('resource-2', true);
        expect(getNodeCompletionValue(SAMPLE_TREE[0], map)).toBe(true);
    });

    it('returns false for empty folder completion', () => {
        const emptyFolder: ExplorerNode = {
            id: 'folder-empty',
            name: 'Empty',
            type: 'folder',
            children: [],
        };
        const map = new Map<string, boolean>();
        expect(getNodeCompletionValue(emptyFolder, map)).toBe(false);
    });
});

