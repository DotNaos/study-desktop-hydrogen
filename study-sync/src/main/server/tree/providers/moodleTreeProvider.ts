import { createLogger } from '@aryazos/ts-base/logging';
import { refreshCourseResources } from '../../../moodle';
import { extractExtensionFromFilename } from '../../../moodle/helpers';
import {
    makeMoodleCourseId,
    makeMoodleFileId,
    parseMoodleNodeId,
} from '../../../moodle/ids';
import { state } from '../../../moodle/state';
import {
    buildCourseNotesFromCache,
    buildSectionNotesFromCache,
} from '../../../moodle/tree';
import type { ProviderNode } from '../../../types';
import type { TreeProvider } from '../provider';
import type { TreeNodeInput } from '../types';

const logger = createLogger('com.aryazos.study-sync.tree.moodle');

function toTreeNodeInput(node: ProviderNode): TreeNodeInput {
    const payload: Record<string, unknown> = {
        providerId: node.providerId,
        fileExtension: node.fileExtension,
        sourceUrl: node.sourceUrl,
        group: node.group,
        readOnly: node.readOnly,
        locked: node.locked,
        materialized: node.materialized,
        mimeType: node.mimeType,
        isGroup: node.isGroup,
    };
    return {
        remoteKey: node.id,
        name: node.name,
        kind:
            (node.type as any) === 'folder' ||
            (node.type as any) === 'composite'
                ? 'folder'
                : 'file',
        payload,
        isGroup: node.isGroup,
    };
}

/**
 * Fetch folder contents from Moodle and attach them as children.
 */
async function attachFolderChildren(
    folderNode: ProviderNode,
    courseId: string,
): Promise<TreeNodeInput> {
    const parsed = parseMoodleNodeId(folderNode.id);
    if (!parsed || parsed.kind !== 'folder') {
        return toTreeNodeInput(folderNode);
    }

    const { folderId } = parsed;
    const resourceId = `folder-${folderId}`;
    const folder = state.resources.get(resourceId);

    if (!folder || !folder.url) {
        logger.warn('Folder not found in cache or missing URL', {
            folderId,
            courseId,
        });
        return toTreeNodeInput(folderNode);
    }

    try {
        const files = await state.fetcher.fetchFolderContents(
            folder.url,
            folderId,
        );
        logger.info(
            `Fetched ${files.length} files from folder ${folder.name}`,
            { folderId, courseId },
        );

        const children: TreeNodeInput[] = files.map((file) => ({
            remoteKey: makeMoodleFileId(courseId, file.id),
            name: file.name,
            kind: 'file' as const,
            payload: {
                providerId: 'moodle',
                fileExtension: extractExtensionFromFilename(file.name),
                sourceUrl: file.url,
                materialized: false,
            },
        }));

        return {
            ...toTreeNodeInput(folderNode),
            children,
        };
    } catch (error) {
        logger.error('Failed to fetch folder contents', {
            folderId,
            courseId,
            error,
        });
        return toTreeNodeInput(folderNode);
    }
}

async function attachSectionChildren(
    sectionNode: ProviderNode,
    courseId: string,
): Promise<TreeNodeInput> {
    const parsed = parseMoodleNodeId(sectionNode.id);
    if (!parsed || parsed.kind !== 'section') {
        return toTreeNodeInput(sectionNode);
    }

    // Mark sections as groups
    sectionNode.isGroup = true;

    const children = buildSectionNotesFromCache(
        parsed.courseId,
        parsed.sectionId,
        sectionNode.id,
    );

    // Process children: attach folder contents for folder nodes
    const processedChildren = await Promise.all(
        children.map(async (child) => {
            if (child.type === 'folder') {
                return attachFolderChildren(child, courseId);
            }
            return toTreeNodeInput(child);
        }),
    );

    return {
        ...toTreeNodeInput(sectionNode),
        children: processedChildren,
    };
}

export const moodleTreeProvider: TreeProvider = {
    id: 'moodle',
    isAuthenticated(): boolean {
        return state.isAuthenticated;
    },
    async listPartitionRoots(): Promise<TreeNodeInput[]> {
        if (!state.isAuthenticated) {
            return [];
        }

        if (state.courses.length === 0) {
            logger.info('No cached courses, fetching from Moodle');
            state.courses = await state.fetcher.fetchCourses();
        }

        // Group courses by category (term)
        const terms = new Set<string>();
        for (const course of state.courses) {
            terms.add(course.category || 'Other');
        }

        return Array.from(terms)
            .sort()
            .map((term) => ({
                remoteKey: `term:${term}`,
                name: term,
                kind: 'folder',
                isGroup: true,
                payload: {
                    providerId: 'moodle',
                    isGroup: true,
                    readOnly: true,
                    locked: true,
                },
            }));
    },

    async fetchSubtree(partitionRemoteKey: string): Promise<TreeNodeInput> {
        if (!partitionRemoteKey.startsWith('term:')) {
            throw new Error(
                `Unsupported Moodle partition key: ${partitionRemoteKey}`,
            );
        }

        const term = partitionRemoteKey.substring(5);
        const courses = state.courses.filter(
            (c) => (c.category || 'Other') === term,
        );

        if (courses.length === 0) {
            // Should not happen if listPartitionRoots is correct, unless courses disappeared
            throw new Error(`No courses found for term: ${term}`);
        }

        logger.info(`Refreshing term ${term} with ${courses.length} courses`);

        // Refresh all courses in parallel
        await Promise.all(
            courses.map((course) => refreshCourseResources(String(course.id))),
        );

        // Build children (Courses) - process each course async due to folder content fetching
        const children: TreeNodeInput[] = await Promise.all(
            courses.map(async (course) => {
                const courseId = String(course.id);
                const courseNode: ProviderNode = {
                    id: makeMoodleCourseId(courseId),
                    name: course.fullname,
                    parent: partitionRemoteKey,
                    type: 'folder' as any, // Cast to any to satisfy strict ProviderNode type
                    materialized: true,
                    readOnly: true,
                    locked: true,
                    providerId: 'moodle',
                    group: term,
                    isGroup: false, // Courses are NOT groups, they are content
                };

                const courseChildren = buildCourseNotesFromCache(
                    courseId,
                    courseNode.id,
                );
                const mappedChildren = await Promise.all(
                    courseChildren.map(async (child) => {
                        const parsedChild = parseMoodleNodeId(child.id);
                        if (parsedChild?.kind === 'section') {
                            return attachSectionChildren(child, courseId);
                        }
                        return toTreeNodeInput(child);
                    }),
                );

                return {
                    ...toTreeNodeInput(courseNode),
                    children: mappedChildren,
                };
            }),
        );

        return {
            remoteKey: partitionRemoteKey,
            name: term,
            kind: 'folder',
            isGroup: true,
            payload: {
                providerId: 'moodle',
                isGroup: true,
                readOnly: true,
                locked: true,
                group: term,
            },
            children,
        };
    },
};
