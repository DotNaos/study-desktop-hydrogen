import { createLogger } from '@aryazos/ts-base/logging';
import { Router } from 'express';
import { getExportRoot } from '../../downloader';
import { primaryProvider } from '../../providers';
import { remoteCache } from '../../remoteCache';
import { ProviderErrorCodes } from '../../types';

const logger = createLogger('com.aryazos.study-sync.server.remote');
const router = Router();

router.post('/index', async (_req, res) => {
    try {
        if (!primaryProvider.isAuthenticated()) {
            res.status(401).json({ error: ProviderErrorCodes.AUTH_REQUIRED });
            return;
        }

        const rootPath = getExportRoot();
        if (!rootPath) {
            res.status(400).json({ error: 'EXPORT_ROOT_REQUIRED' });
            return;
        }

        // 1. Fetch all top-level courses
        const courses = await primaryProvider.listNodes(); // Returns courses
        logger.info(`Fetched ${courses.length} courses`);

        const allRecords: any[] = [];
        const now = Date.now();

        // 2. Iterate through each course to fetch its contents (shallow, no folder recursion)
        for (const course of courses) {
            // Add course itself
            allRecords.push({
                id: course.id,
                name: course.name,
                parent: course.parent || 'root',
                type: 'folder',
                groupName: course.group,
                fileExtension: course.fileExtension,
                sourceUrl: course.sourceUrl,
                providerId: course.providerId || 'moodle',
                indexedAt: now,
            });

            // Add course contents
            try {
                logger.info(`Indexing course: ${course.name} (${course.id})`);
                const contents = await primaryProvider.listNodes(course.id);
                contents.forEach((n) => {
                    allRecords.push({
                        id: n.id,
                        name: n.name,
                        parent: n.parent || course.id,
                        type:
                            (n.type as string) === 'folder' ||
                            (n.type as string) === 'category' ||
                            (n.type as string) === 'course'
                                ? 'folder'
                                : 'file',
                        groupName: n.group,
                        fileExtension: n.fileExtension,
                        sourceUrl: n.sourceUrl,
                        providerId: n.providerId || 'moodle',
                        indexedAt: now,
                    });
                });
            } catch (err) {
                logger.error(
                    `Failed to index contents for course ${course.id}`,
                    { error: err },
                );
                // Continue with other courses even if one fails
            }
        }

        logger.info(`Total nodes to index: ${allRecords.length}`);
        await remoteCache.setNodes(allRecords);
        logger.info(`Indexed ${allRecords.length} nodes to cache`);

        res.json({ ok: true, count: allRecords.length });
    } catch (error) {
        logger.error('Failed to index remote nodes', { error });
        res.status(500).json({ error: 'INDEX_FAILED' });
    }
});

router.get('/search', async (req, res) => {
    try {
        const rootPath = getExportRoot();
        if (!rootPath) {
            res.status(400).json({ error: 'EXPORT_ROOT_REQUIRED' });
            return;
        }

        const query = String(req.query?.q || '');

        const results = await remoteCache.searchNodes(query);

        // Map to API format (ensure parentId is present)
        const nodes = results.map((node) => ({
            ...node,
            parentId: node.parent || '',
            groupName: node.groupName, // ensure explicit field if needed
        }));

        res.json({ nodes });
    } catch (error) {
        logger.error('Failed to search remote nodes', { error });
        res.status(500).json({ error: 'SEARCH_FAILED' });
    }
});

export default router;
