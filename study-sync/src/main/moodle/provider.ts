import { createLogger } from '@aryazos/ts-base/logging';
import { remoteCache } from '../remoteCache';
import { convertBufferToPdf, isConvertible } from '../services/conversion';
import type { DataProvider, ProviderNode } from '../types';
import { saveMoodleCache } from './cache';
import {
    extensionFromContentType,
    extractExtensionFromFilename,
    normalizeFileExtension,
} from './helpers';
import {
    makeMoodleCourseId,
    makeMoodleFileId,
    makeMoodleFolderId,
    makeMoodleResourceId,
    makeMoodleSectionId,
    makeMoodleTermId,
    parseMoodleNodeId,
} from './ids';
import { state } from './state';
import { buildCourseNotesFromCache, buildSectionNotesFromCache } from './tree';

const logger = createLogger('com.aryazos.providers.moodle.provider');

/**
 * Moodle note provider.
 *
 * Pure data provider - authentication is handled at the Electron layer.
 * Uses HTTP requests with session cookies for data fetching.
 */
export const moodleProvider: DataProvider = {
    id: 'moodle',
    get name() {
        return `Moodle ${state.selectedSchool.name}`;
    },
    isAuthenticated(): boolean {
        return state.isAuthenticated;
    },

    async initialize(): Promise<void> {
        // No-op: auth is handled at Electron layer via setMoodleCookies()
    },

    async dispose(): Promise<void> {
        state.isAuthenticated = false;
        state.courses = [];
        state.resources.clear();
    },

    // eslint-disable-next-line sonarjs/cognitive-complexity
    async listNodes(parentId?: string): Promise<ProviderNode[]> {
        logger.debug(`listNodes called`, {
            parentId,
            isAuthenticated: state.isAuthenticated,
        });

        // Not authenticated - return empty
        if (!state.isAuthenticated) {
            return [];
        }

        const notes: ProviderNode[] = [];

        // Root level: return all terms (grouped by category)
        if (!parentId || parentId === 'root') {
            const terms = new Set<string>();
            for (const course of state.courses) {
                terms.add(course.category || 'Other');
            }

            for (const term of Array.from(terms).sort((a, b) =>
                a.localeCompare(b),
            )) {
                notes.push({
                    id: makeMoodleTermId(term),
                    name: term,
                    parent: 'root',
                    type: 'folder',
                    materialized: true,
                    readOnly: true,
                    locked: true,
                    providerId: 'moodle',
                    isGroup: true,
                    group: term,
                });
            }
            return notes;
        }

        const parsedParent = parentId ? parseMoodleNodeId(parentId) : null;

        if (parsedParent?.kind === 'term') {
            // List courses in this term
            const targetTermId = parentId;

            const coursesInTerm = state.courses.filter((course) => {
                const term = course.category || 'Other';
                return makeMoodleTermId(term) === targetTermId;
            });

            for (const course of coursesInTerm) {
                notes.push({
                    id: makeMoodleCourseId(course.id),
                    name: course.fullname,
                    parent: parentId,
                    type: 'folder',
                    materialized: true,
                    readOnly: true,
                    locked: true,
                    providerId: 'moodle',
                    group: course.category || undefined,
                    isGroup: false,
                });
            }
            return notes;
        }

        if (parsedParent?.kind === 'course') {
            const courseId = parsedParent.courseId;

            logger.debug(`listNodes for course ${courseId}`, {
                isLoaded: state.loadedCourses.has(courseId),
                loadedCoursesCount: state.loadedCourses.size,
            });

            if (state.loadedCourses.has(courseId)) {
                logger.debug(`Returning from cache for course ${courseId}`);
                const nodes = buildCourseNotesFromCache(courseId, parentId);
                // Mark sections as groups
                return nodes.map((n) => {
                    const p = parseMoodleNodeId(n.id);
                    if (p?.kind === 'section') {
                        return { ...n, isGroup: true };
                    }
                    return n;
                });
            }

            logger.debug(
                `Cache miss, fetching from API for course ${courseId}`,
            );
            logger.info(`Fetching resources for course ${courseId}...`);
            const { resources, contextId } =
                await state.fetcher.fetchCourseResources(courseId);

            // Store contextId for batch download support
            if (contextId) {
                state.courseContextIds.set(courseId, contextId);
            }

            // Cache all resources
            for (const resource of resources) {
                state.resources.set(resource.id, resource);
            }

            state.loadedCourses.add(courseId);
            logger.info(
                `Course ${courseId} cached with ${resources.length} resources`,
                { contextId },
            );

            // Persist to disk
            // Save cache
            saveMoodleCache(
                state.courses,
                state.resources,
                state.loadedCourses,
                state.courseContextIds,
            );

            // Use the cache builder which groups by section
            const nodes = buildCourseNotesFromCache(courseId, parentId);
            return nodes.map((n) => {
                const p = parseMoodleNodeId(n.id);
                if (p?.kind === 'section') {
                    return { ...n, isGroup: true };
                }
                return n;
            });
        }

        if (parsedParent?.kind === 'section') {
            const { courseId, sectionId } = parsedParent;

            // Ensure course is loaded
            if (!state.loadedCourses.has(courseId)) {
                await this.listNodes(makeMoodleCourseId(courseId));
            }

            return buildSectionNotesFromCache(courseId, sectionId, parentId);
        }

        if (parsedParent?.kind === 'folder') {
            const { courseId, folderId } = parsedParent;

            if (!state.loadedCourses.has(courseId)) {
                await this.listNodes(makeMoodleCourseId(courseId));
            }

            const resourceId = `folder-${folderId}`;
            let folder = state.resources.get(resourceId);

            if (!folder) {
                logger.warn('Folder not found in cache when listing', {
                    courseId,
                    folderId,
                    parentId,
                });
                return [];
            }

            const files = await state.fetcher.fetchFolderContents(
                folder.url,
                folderId,
            );
            return files.map((file) => ({
                id: makeMoodleFileId(courseId, file.id),
                name: file.name,
                parent: parentId,
                type: 'file',
                fileExtension: extractExtensionFromFilename(file.name),
                materialized: true,
                providerId: 'moodle',
                sourceUrl: file.url,
            }));
        }

        return notes;
    },
    async getNode(id: string): Promise<ProviderNode | null> {
        return this.materializeNode(id);
    },

    async downloadFile(nodeId: string): Promise<Buffer> {
        const node = await this.materializeNode(nodeId);
        if (!node) {
            throw new Error(`Node ${nodeId} is not downloadable`);
        }

        const data = remoteCache.getFile(nodeId, 'pdf');
        if (!data) {
            throw new Error(`File ${nodeId} not found in cache`);
        }

        return data;
    },

    // eslint-disable-next-line sonarjs/cognitive-complexity
    async materializeNode(noteId: string): Promise<ProviderNode | null> {
        if (!state.isAuthenticated) {
            throw new Error('Moodle not connected');
        }

        const parsedId = parseMoodleNodeId(noteId);
        if (!parsedId) {
            throw new Error(`Unknown or invalid Moodle node ID: ${noteId}`);
        }

        if (parsedId.kind === 'term') {
            // Reconstruct term node by finding a course with matching category
            let foundTerm: string | null = null;
            for (const course of state.courses) {
                const t = course.category || 'Other';
                if (makeMoodleTermId(t) === noteId) {
                    foundTerm = t;
                    break;
                }
            }

            if (!foundTerm) return null;

            return {
                id: noteId,
                name: foundTerm,
                parent: 'root',
                type: 'folder',
                materialized: true,
                readOnly: true,
                locked: true,
                providerId: 'moodle',
                isGroup: true,
                group: foundTerm,
            };
        }

        if (parsedId.kind === 'course') {
            const courseId = parsedId.courseId;
            let course =
                state.courses.find((c) => String(c.id) === courseId) || null;

            if (!course) {
                logger.info(
                    `Course ${courseId} missing from cache, fetching all courses...`,
                );
                state.courses = await state.fetcher.fetchCourses();
                course =
                    state.courses.find((c) => String(c.id) === courseId) ||
                    null;
            }

            if (!course) {
                return null;
            }

            const term = course.category || 'Other';
            return {
                id: noteId,
                name: course.fullname,
                parent: makeMoodleTermId(term),
                type: 'folder',
                materialized: true,
                readOnly: true,
                locked: true,
                providerId: 'moodle',
                group: term,
            };
        }

        if (parsedId.kind === 'resource') {
            const { courseId: resourceCourseId, resourceId } = parsedId;
            let resource = state.resources.get(resourceId);

            if (!resource) {
                logger.info(
                    `Resource ${resourceId} missing from cache, fetching course ${resourceCourseId}...`,
                );
                await moodleProvider.listNodes(
                    makeMoodleCourseId(resourceCourseId),
                );
                resource = state.resources.get(resourceId);
            }

            if (!resource) {
                throw new Error(
                    `Resource/Node ${noteId} not found even after fetching course ${resourceCourseId}.`,
                );
            }

            logger.info('Downloading resource', {
                resourceId,
                url: resource.url,
                type: resource.type,
            });

            if (resource.type === 'folder') {
                throw new Error(
                    `Folder resources are not yet supported: ${resource.name}`,
                );
            }

            // Check if file is already cached
            if (remoteCache.hasFile(noteId, 'pdf')) {
                logger.info('Resource already cached', { resourceId });
                const fileExtension =
                    normalizeFileExtension(resource.fileType) ||
                    extractExtensionFromFilename(resource.name) ||
                    'pdf';

                return {
                    id: noteId,
                    name: resource.name,
                    parent: resource.sectionId
                        ? makeMoodleSectionId(
                              resource.courseId,
                              resource.sectionId,
                          )
                        : makeMoodleCourseId(resource.courseId),
                    type: 'file',
                    fileExtension,
                    materialized: true,
                    providerId: 'moodle',
                    sourceUrl: resource.url,
                };
            }

            // Check if we should trigger batch download
            const contextId = state.courseContextIds.get(resourceCourseId);

            if (
                contextId &&
                !state.batchDownloadAttempted.has(resourceCourseId)
            ) {
                // Count uncached PDF files in this course
                let uncachedCount = 0;
                for (const res of state.resources.values()) {
                    if (
                        res.courseId === resourceCourseId &&
                        res.type === 'resource' &&
                        res.fileType === 'pdf'
                    ) {
                        const resNodeId = makeMoodleResourceId(
                            resourceCourseId,
                            res.id,
                        );
                        if (!remoteCache.hasFile(resNodeId, 'pdf')) {
                            uncachedCount++;
                        }
                    }
                }

                if (uncachedCount > 5) {
                    logger.info(
                        `Triggering batch download for course ${resourceCourseId}`,
                        { uncachedCount, contextId },
                    );
                    state.batchDownloadAttempted.add(resourceCourseId);
                    try {
                        const { batchDownloadCourse } =
                            await import('./batch-download');
                        const stats = await batchDownloadCourse(
                            resourceCourseId,
                            contextId,
                            {
                                convertToPdf:
                                    state.conversionOptions.convertToPdf,
                                includeAll: state.conversionOptions.includeAll,
                            },
                        );
                        logger.info('Batch download complete', stats);

                        // Check if our file is now cached
                        if (remoteCache.hasFile(resourceId, 'pdf')) {
                            // Copy to proper node ID
                            const data = remoteCache.getFile(resourceId, 'pdf');
                            if (data) {
                                remoteCache.setFile(noteId, data, 'pdf');
                                const fileExtension =
                                    normalizeFileExtension(resource.fileType) ||
                                    extractExtensionFromFilename(
                                        resource.name,
                                    ) ||
                                    'pdf';

                                return {
                                    id: noteId,
                                    name: resource.name,
                                    parent: resource.sectionId
                                        ? makeMoodleSectionId(
                                              resource.courseId,
                                              resource.sectionId,
                                          )
                                        : makeMoodleCourseId(resource.courseId),
                                    type: 'file',
                                    fileExtension,
                                    materialized: true,
                                    providerId: 'moodle',
                                    sourceUrl: resource.url,
                                };
                            }
                        }
                    } catch (err) {
                        logger.warn(
                            'Batch download failed, falling back to individual download',
                            { error: err },
                        );
                    }
                } else {
                    logger.debug('Batch download not triggered', {
                        reason:
                            uncachedCount <= 5
                                ? 'too few uncached files'
                                : 'unknown',
                        uncachedCount,
                        courseId: resourceCourseId,
                    });
                }
            } else {
                // Check if batch download SHOULD be used but can't
                // Count uncached PDF files to determine if we need batch download
                let uncachedCount = 0;
                for (const res of state.resources.values()) {
                    if (
                        res.courseId === resourceCourseId &&
                        res.type === 'resource' &&
                        res.fileType === 'pdf'
                    ) {
                        const resNodeId = makeMoodleResourceId(
                            resourceCourseId,
                            res.id,
                        );
                        if (!remoteCache.hasFile(resNodeId, 'pdf')) {
                            uncachedCount++;
                        }
                    }
                }

                if (uncachedCount > 5) {
                    // Batch download SHOULD be used but we can't
                    if (!contextId) {
                        throw new Error(
                            `Batch download required for course ${resourceCourseId} (${uncachedCount} uncached files) but contextId is missing. ` +
                                `Please clear the cache and re-fetch: rm ~/.aryazos/study-sync/cache/moodle-cache.json`,
                        );
                    } else if (
                        state.batchDownloadAttempted.has(resourceCourseId)
                    ) {
                        // Batch was already attempted and failed - fall through to individual download
                        logger.warn(
                            'Batch download already attempted and failed, using individual download',
                            {
                                courseId: resourceCourseId,
                                resourceId,
                                uncachedCount,
                            },
                        );
                    }
                } else {
                    // Few enough files that individual download is acceptable
                    logger.debug(
                        'Using individual download (few uncached files)',
                        { uncachedCount, courseId: resourceCourseId },
                    );
                }
            }

            // Individual download fallback
            logger.info('Downloading resource individually', {
                resourceId,
                resourceName: resource.name,
            });
            const downloadResult = await state.fetcher.downloadFileToBuffer(
                resource.url,
            );
            const {
                buffer: fileBuffer,
                contentType,
                filename,
            } = downloadResult;

            logger.info('Download result', {
                resourceId,
                contentType,
                filename,
                size: fileBuffer.length,
            });

            if (contentType.includes('text/html')) {
                const htmlPreview = fileBuffer
                    .toString('utf-8')
                    .substring(0, 200);
                logger.warn(
                    'Got HTML instead of file - this appears to be a page resource, not a downloadable file',
                    { resourceId, resourceName: resource.name, htmlPreview },
                );
                return null;
            }

            let fileExtension =
                extractExtensionFromFilename(filename || '') ||
                normalizeFileExtension(resource.fileType) ||
                extractExtensionFromFilename(resource.name) ||
                extensionFromContentType(contentType);

            let dataToCache = fileBuffer;

            // Convert Office files to PDF if conversion is enabled
            if (
                state.conversionOptions.convertToPdf &&
                fileExtension &&
                isConvertible(fileExtension)
            ) {
                logger.info('Converting file to PDF', {
                    resourceId,
                    fileExtension,
                });
                const conversionResult = await convertBufferToPdf(
                    fileBuffer,
                    filename || `file.${fileExtension}`,
                );
                if (conversionResult.success && conversionResult.pdfBuffer) {
                    dataToCache = conversionResult.pdfBuffer;
                    fileExtension = 'pdf';
                    logger.info('Conversion successful', {
                        resourceId,
                        newSize: dataToCache.length,
                    });
                } else {
                    logger.warn('Conversion failed, caching original', {
                        resourceId,
                        error: conversionResult.error,
                    });
                }
            }

            const cachedPath = remoteCache.setFile(
                noteId,
                dataToCache,
                fileExtension,
            );
            logger.info('Resource downloaded and cached', {
                resourceId,
                cachedPath,
                size: dataToCache.length,
                fileExtension,
            });

            return {
                id: noteId,
                name: resource.name,
                parent: resource.sectionId
                    ? makeMoodleSectionId(resource.courseId, resource.sectionId)
                    : makeMoodleCourseId(resource.courseId),
                type: 'file',
                fileExtension,
                materialized: true,
                providerId: 'moodle',
                sourceUrl: resource.url,
            };
        }

        if (parsedId.kind === 'file') {
            const { courseId: fileCourseId, fileId } = parsedId;
            const folderId = fileId.split('-file-')[0];
            if (!folderId) {
                throw new Error(`Invalid folder file id: ${fileId}`);
            }

            let folder = state.resources.get(`folder-${folderId}`);
            if (!folder) {
                await moodleProvider.listNodes(
                    makeMoodleCourseId(fileCourseId),
                );
                folder = state.resources.get(`folder-${folderId}`);
            }

            if (!folder) {
                logger.warn('Folder not found for file materialization', {
                    fileId,
                    folderId,
                    fileCourseId,
                });
                return null;
            }

            const files = await state.fetcher.fetchFolderContents(
                folder.url,
                folderId,
            );
            const file = files.find((entry) => entry.id === fileId);

            if (!file) {
                logger.warn('File not found in folder contents', {
                    fileId,
                    folderId,
                    fileCourseId,
                });
                return null;
            }

            logger.info('Downloading file from folder', {
                fileId,
                url: file.url,
            });
            const downloadResult = await state.fetcher.downloadFileToBuffer(
                file.url,
            );
            const {
                buffer: fileBuffer,
                contentType,
                filename,
            } = downloadResult;

            logger.info('File download result', {
                fileId,
                contentType,
                size: fileBuffer.length,
            });

            if (contentType.includes('text/html')) {
                logger.warn('Got HTML instead of file for folder file', {
                    fileId,
                    fileName: file.name,
                });
                return null;
            }

            const fileExtension =
                extractExtensionFromFilename(filename || '') ||
                extractExtensionFromFilename(file.name) ||
                extensionFromContentType(contentType);

            const cachedPath = remoteCache.setFile(
                noteId,
                fileBuffer,
                fileExtension,
            );
            logger.info('File downloaded and cached', {
                fileId,
                cachedPath,
                size: fileBuffer.length,
                fileExtension,
            });

            return {
                id: noteId,
                name: file.name,
                parent: makeMoodleFolderId(fileCourseId, folderId),
                type: 'file',
                fileExtension,
                materialized: true,
                providerId: 'moodle',
                sourceUrl: file.url,
            };
        }

        if (parsedId.kind === 'section') {
            const { courseId, sectionId } = parsedId;
            // Find any resource in this section to get the name
            let sectionName = 'Section';
            for (const res of state.resources.values()) {
                if (
                    res.courseId === courseId &&
                    res.sectionId === sectionId &&
                    res.sectionName
                ) {
                    sectionName = res.sectionName;
                    break;
                }
            }

            return {
                id: noteId,
                name: sectionName,
                parent: makeMoodleCourseId(courseId),
                type: 'folder',
                materialized: true,
                readOnly: true,
                providerId: 'moodle',
            };
        }

        if (parsedId.kind === 'folder') {
            const { courseId, folderId } = parsedId;
            const resourceId = `folder-${folderId}`;
            const folder = state.resources.get(resourceId);

            if (!folder) {
                // Folder might exist but not be providing files, or just invalid
                // Allow returning a stub if we trust the ID, but better to return null if not found?
                // If we created it in listNodes, it should be in resources.
                logger.warn(
                    `Folder ${folderId} not found in cache during materialize`,
                    { noteId },
                );
                return null;
            }

            return {
                id: noteId,
                name: folder.name,
                parent: folder.sectionId
                    ? makeMoodleSectionId(courseId, folder.sectionId)
                    : makeMoodleCourseId(courseId),
                type: 'folder',
                materialized: true, // It is a container
                readOnly: true,
                providerId: 'moodle',
                sourceUrl: folder.url,
            };
        }

        throw new Error(`Unknown or invalid Moodle node ID: ${noteId}`);
    },
};
