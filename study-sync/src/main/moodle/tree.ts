import { createLogger } from '@aryazos/ts-base/logging';
import type { ProviderNode } from '../types';
import { MoodleResource } from './browser';
import {
    extractExtensionFromFilename,
    normalizeFileExtension,
} from './helpers';
import {
    makeMoodleFolderId,
    makeMoodleResourceId,
    makeMoodleSectionId,
} from './ids';
import { state } from './state';

const logger = createLogger('com.aryazos.providers.moodle.tree');

/**
 * Build course notes from cached resources.
 * Groups resources by section and returns section folders with resources as children.
 */
export function buildCourseNotesFromCache(
    courseId: string,
    parentId: string,
): ProviderNode[] {
    const notes: ProviderNode[] = [];

    logger.info(`Building notes from cache for course ${courseId}`, {
        totalResources: state.resources.size,
        totalLoadedCourses: state.loadedCourses.size,
    });

    // Group resources by section
    const sectionMap = new Map<
        string,
        { sectionId: string; resources: MoodleResource[] }
    >();
    const ungrouped: MoodleResource[] = [];

    for (const [_resourceId, resource] of state.resources) {
        if (resource.courseId !== courseId) continue;

        if (resource.sectionId && resource.sectionName) {
            const key = resource.sectionId;
            if (!sectionMap.has(key)) {
                sectionMap.set(key, {
                    sectionId: resource.sectionId,
                    resources: [],
                });
            }
            sectionMap.get(key)!.resources.push(resource);
        } else {
            ungrouped.push(resource);
        }
    }

    // Create section folder nodes
    for (const [sectionId, { resources }] of sectionMap) {
        const sectionName = resources[0]?.sectionName || 'Section';
        notes.push({
            id: makeMoodleSectionId(courseId, sectionId),
            name: sectionName,
            parent: parentId,
            type: 'folder',
            materialized: true,
            providerId: 'moodle',
        });
    }

    // Add ungrouped resources directly under course
    for (const resource of ungrouped) {
        const isFolder = resource.type === 'folder';
        notes.push({
            id: isFolder
                ? makeMoodleFolderId(
                      courseId,
                      resource.id.replace('folder-', ''),
                  )
                : makeMoodleResourceId(courseId, resource.id),
            name: resource.name,
            parent: parentId,
            type: isFolder ? 'folder' : 'file',
            fileExtension: isFolder
                ? undefined
                : normalizeFileExtension(resource.fileType) ||
                  extractExtensionFromFilename(resource.name),
            materialized: isFolder,
            providerId: 'moodle',
            sourceUrl: resource.url,
        });
    }

    logger.info(
        `Built ${notes.length} items (${sectionMap.size} sections) for course ${courseId}`,
    );
    return notes;
}

/**
 * Build section contents from cached resources.
 */
export function buildSectionNotesFromCache(
    courseId: string,
    sectionId: string,
    parentId: string,
): ProviderNode[] {
    const notes: ProviderNode[] = [];

    for (const [_resourceId, resource] of state.resources) {
        if (resource.courseId !== courseId) continue;
        if (resource.sectionId !== sectionId) continue;

        const isFolder = resource.type === 'folder';
        notes.push({
            id: isFolder
                ? makeMoodleFolderId(
                      courseId,
                      resource.id.replace('folder-', ''),
                  )
                : makeMoodleResourceId(courseId, resource.id),
            name: resource.name,
            parent: parentId,
            type: isFolder ? 'folder' : 'file',
            fileExtension: isFolder
                ? undefined
                : normalizeFileExtension(resource.fileType) ||
                  extractExtensionFromFilename(resource.name),
            materialized: isFolder,
            providerId: 'moodle',
            sourceUrl: resource.url,
        });
    }

    return notes;
}
