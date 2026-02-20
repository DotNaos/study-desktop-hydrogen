import { createLogger } from '@aryazos/ts-base/logging';
import { Router } from 'express';
import { getMoodleCourses } from '../../moodle';
import { primaryProvider } from '../../providers';
import { remoteCache } from '../../remoteCache';
import { ProviderErrorCodes } from '../../types';
import { extractTextFromPdf, textCache } from '../services/textExtractor';
import { treeService } from '../tree';

const logger = createLogger('com.aryazos.study-sync.server.nodes');
const router = Router();
const nameSorter = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: 'base',
});
const PROGRESS_MIN = 0;
const PROGRESS_MAX = 100;

function sortNodesByName<T extends { name?: string | null }>(nodes: T[]): T[] {
    return [...nodes].sort((a, b) => {
        const left = (a.name ?? '').trim();
        const right = (b.name ?? '').trim();
        return nameSorter.compare(left, right);
    });
}

function normalizeProgress(value: unknown): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return null;
    }
    const rounded = Math.round(value);
    return Math.min(Math.max(rounded, PROGRESS_MIN), PROGRESS_MAX);
}

async function ensureLeafNodes(ids: string[]): Promise<string[]> {
    const invalid: string[] = [];
    for (const id of ids) {
        const node = await treeService.store.getNode(id);
        if (!node || node.type === 'folder') {
            invalid.push(id);
        }
    }
    return invalid;
}

// Get all root nodes
router.get('/nodes', async (req, res) => {
    try {
        if (!primaryProvider.isAuthenticated()) {
            res.status(401).json({
                error: ProviderErrorCodes.AUTH_REQUIRED,
                message:
                    'Not authenticated. Configure credentials in Study Sync.',
            });
            return;
        }

        const includeGroups = req.query.includeGroups !== 'false';

        await treeService.ensureBuilt();

        if (req.query.mode === 'tree') {
            const allNodes = await treeService.store.getAllNodes(includeGroups);
            const nodeMap = new Map<string, any>();
            const roots: any[] = [];

            // 1. Initialize Map
            for (const node of allNodes) {
                nodeMap.set(node.id, { ...node, children: [], chapters: [] });
            }

            // 2. Build Tree
            for (const node of allNodes) {
                const nodeWithChildren = nodeMap.get(node.id);
                if (
                    node.parent &&
                    node.parent !== 'root' &&
                    nodeMap.has(node.parent)
                ) {
                    const parent = nodeMap.get(node.parent);
                    parent.children.push(nodeWithChildren);
                    parent.chapters.push(nodeWithChildren); // Support both naming conventions
                } else {
                    roots.push(nodeWithChildren);
                }
            }

            // Sort roots and children
            const sortedRoots = sortNodesByName(roots);
            const sortChildren = (nodes: any[]) => {
                for (const node of nodes) {
                    if (node.children.length > 0) {
                        node.children = sortNodesByName(node.children);
                        node.chapters = node.children;
                        sortChildren(node.children);
                    }
                }
            };
            sortChildren(sortedRoots);

            res.json(sortedRoots);
            return;
        }

        const nodes = await treeService.store.getRootNodes(includeGroups);
        res.json(sortNodesByName(nodes));

        for (const node of nodes) {
            if (!node.isGroup) {
                void treeService.refreshPartition(node.id, { force: false });
            }
        }
    } catch (error) {
        logger.error('Error getting nodes', { error });
        res.status(500).json({ error: 'Failed to get nodes' });
    }
});

// New root endpoint (alias)
router.get('/nodes/root', async (req, res) => {
    try {
        if (!primaryProvider.isAuthenticated()) {
            res.status(401).json({
                error: ProviderErrorCodes.AUTH_REQUIRED,
                message:
                    'Not authenticated. Configure credentials in Study Sync.',
            });
            return;
        }

        const includeGroups = req.query.includeGroups !== 'false';

        await treeService.ensureBuilt();
        const nodes = await treeService.store.getRootNodes(includeGroups);
        res.json(sortNodesByName(nodes));

        for (const node of nodes) {
            if (!node.isGroup) {
                void treeService.refreshPartition(node.id, { force: false });
            }
        }
    } catch (error) {
        logger.error('Error getting root nodes', { error });
        res.status(500).json({ error: 'Failed to get root nodes' });
    }
});

// Search nodes
router.get('/nodes/search', async (req, res) => {
    try {
        if (!primaryProvider.isAuthenticated()) {
            res.status(401).json({ error: ProviderErrorCodes.AUTH_REQUIRED });
            return;
        }

        const query = String(req.query?.q || '');
        const limit = Math.min(
            Math.max(Number(req.query?.limit || 50), 1),
            200,
        );

        await treeService.ensureBuilt();
        const results = await treeService.store.search(query, limit);
        res.json(results);
    } catch (error) {
        logger.error('Error searching nodes', { error });
        res.status(500).json({ error: 'Failed to search nodes' });
    }
});

// Get node by ID
router.get('/nodes/:id', async (req, res) => {
    try {
        if (!primaryProvider.isAuthenticated()) {
            res.status(401).json({ error: ProviderErrorCodes.AUTH_REQUIRED });
            return;
        }

        await treeService.ensureBuilt();
        const node = await treeService.store.getNode(req.params.id);
        if (!node) {
            res.status(404).json({ error: ProviderErrorCodes.NOT_FOUND });
            return;
        }
        res.json(node);
    } catch (error) {
        logger.error('Error getting node', { error, nodeId: req.params.id });
        res.status(500).json({ error: 'Failed to get node' });
    }
});

// Get children of a node (lazy load)
router.get('/nodes/:id/children', async (req, res) => {
    try {
        if (!primaryProvider.isAuthenticated()) {
            res.status(401).json({ error: ProviderErrorCodes.AUTH_REQUIRED });
            return;
        }

        const includeGroups = req.query.includeGroups !== 'false';

        await treeService.ensureBuilt();
        const children = await treeService.store.getChildren(
            req.params.id,
            includeGroups,
        );
        res.json(sortNodesByName(children));

        // Only auto-refresh if we are asking about children of a non-group node,
        // or if the implementation handles it. For now, keep it simple.
        void treeService.refreshPartitionForNode(req.params.id, {
            force: false,
        });
    } catch (error) {
        logger.error('Error getting children', {
            error,
            parentId: req.params.id,
        });
        res.status(500).json({ error: 'Failed to get children' });
    }
});

// Set progress (0-100) for a leaf node
router.post('/nodes/:id/progress', async (req, res) => {
    try {
        if (!primaryProvider.isAuthenticated()) {
            res.status(401).json({ error: ProviderErrorCodes.AUTH_REQUIRED });
            return;
        }

        const progress = normalizeProgress(req.body?.progress);
        if (progress === null) {
            res.status(400).json({
                error: 'Invalid progress value. Expected number 0-100.',
            });
            return;
        }

        await treeService.ensureBuilt();
        const invalid = await ensureLeafNodes([req.params.id]);
        if (invalid.length > 0) {
            res.status(400).json({
                error: 'Progress can only be set on leaf nodes.',
                invalid,
            });
            return;
        }

        await treeService.store.setBatchProgress({ [req.params.id]: progress });

        // Return updated node
        const node = await treeService.store.getNode(req.params.id);
        res.json(node);
    } catch (error) {
        logger.error('Error setting progress', {
            error,
            nodeId: req.params.id,
        });
        res.status(500).json({ error: 'Failed to set progress' });
    }
});

// Batch set progress status
router.post('/nodes/progress/batch', async (req, res) => {
    try {
        if (!primaryProvider.isAuthenticated()) {
            res.status(401).json({ error: ProviderErrorCodes.AUTH_REQUIRED });
            return;
        }

        const { updates } = req.body;
        if (!updates || typeof updates !== 'object') {
            res.status(400).json({
                error: 'Invalid updates format. Expected record of id -> progress.',
            });
            return;
        }

        const normalizedUpdates: Record<string, number> = {};
        for (const [id, rawValue] of Object.entries(updates)) {
            const progress = normalizeProgress(rawValue);
            if (progress === null) {
                res.status(400).json({
                    error: 'All values must be numbers between 0 and 100.',
                });
                return;
            }
            normalizedUpdates[id] = progress;
        }

        await treeService.ensureBuilt();
        const invalid = await ensureLeafNodes(Object.keys(normalizedUpdates));
        if (invalid.length > 0) {
            res.status(400).json({
                error: 'Progress can only be set on leaf nodes.',
                invalid,
            });
            return;
        }

        await treeService.store.setBatchProgress(normalizedUpdates);

        res.json({
            success: true,
            count: Object.keys(normalizedUpdates).length,
        });
    } catch (error) {
        logger.error('Error setting batch progress', { error });
        res.status(500).json({ error: 'Failed to set batch progress' });
    }
});

// Backwards compatible completion endpoints
router.post('/nodes/:id/completion', async (req, res) => {
    try {
        if (!primaryProvider.isAuthenticated()) {
            res.status(401).json({ error: ProviderErrorCodes.AUTH_REQUIRED });
            return;
        }

        const { completed } = req.body;
        if (typeof completed !== 'boolean') {
            res.status(400).json({ error: 'Invalid completion status' });
            return;
        }

        await treeService.ensureBuilt();
        const invalid = await ensureLeafNodes([req.params.id]);
        if (invalid.length > 0) {
            res.status(400).json({
                error: 'Completion can only be set on leaf nodes.',
                invalid,
            });
            return;
        }

        const progress = completed ? 100 : 0;
        await treeService.store.setBatchProgress({ [req.params.id]: progress });

        const node = await treeService.store.getNode(req.params.id);
        res.json(node);
    } catch (error) {
        logger.error('Error setting completion', {
            error,
            nodeId: req.params.id,
        });
        res.status(500).json({ error: 'Failed to set completion' });
    }
});

router.post('/nodes/completion/batch', async (req, res) => {
    try {
        if (!primaryProvider.isAuthenticated()) {
            res.status(401).json({ error: ProviderErrorCodes.AUTH_REQUIRED });
            return;
        }

        const { updates } = req.body;
        if (!updates || typeof updates !== 'object') {
            res.status(400).json({
                error: 'Invalid updates format. Expected record of id -> boolean.',
            });
            return;
        }

        const normalizedUpdates: Record<string, number> = {};
        for (const [id, rawValue] of Object.entries(updates)) {
            if (typeof rawValue !== 'boolean') {
                res.status(400).json({ error: 'All values must be booleans.' });
                return;
            }
            normalizedUpdates[id] = rawValue ? 100 : 0;
        }

        await treeService.ensureBuilt();
        const invalid = await ensureLeafNodes(Object.keys(normalizedUpdates));
        if (invalid.length > 0) {
            res.status(400).json({
                error: 'Completion can only be set on leaf nodes.',
                invalid,
            });
            return;
        }

        await treeService.store.setBatchProgress(normalizedUpdates);

        res.json({
            success: true,
            count: Object.keys(normalizedUpdates).length,
        });
    } catch (error) {
        logger.error('Error setting batch completion', { error });
        res.status(500).json({ error: 'Failed to set batch completion' });
    }
});

// Force refresh a node
router.post('/nodes/:id/refresh', async (req, res) => {
    try {
        if (!primaryProvider.isAuthenticated()) {
            res.status(401).json({ error: ProviderErrorCodes.AUTH_REQUIRED });
            return;
        }

        const nodeId = req.params.id;

        await treeService.ensureBuilt();
        await treeService.refreshPartitionForNode(nodeId, { force: true });
        const children = await treeService.store.getChildren(nodeId);
        res.json({ success: true, nodes: sortNodesByName(children) });
    } catch (error) {
        logger.error('Error refreshing node', { error, nodeId: req.params.id });
        res.status(500).json({ error: 'Failed to refresh node' });
    }
});

// Download node data
router.get('/nodes/:id/data', async (req, res) => {
    try {
        if (!primaryProvider.isAuthenticated()) {
            res.status(401).json({ error: ProviderErrorCodes.AUTH_REQUIRED });
            return;
        }

        const nodeId = req.params.id;

        // Check if file is cached
        if (remoteCache.hasFile(nodeId)) {
            const data = remoteCache.getFile(nodeId);
            if (data) {
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader(
                    'Content-Disposition',
                    `inline; filename="${nodeId}.pdf"`,
                );
                res.send(data);
                return;
            }
        }

        // Need to materialize (download) the file first
        try {
            const node = await primaryProvider.materializeNode(nodeId);

            if (node === null) {
                res.status(422).json({
                    error: 'UNSUPPORTED_RESOURCE',
                    message:
                        'This resource is a page, not a downloadable file.',
                });
                return;
            }

            // After materialization, check cache again
            if (remoteCache.hasFile(nodeId)) {
                const data = remoteCache.getFile(nodeId);
                if (data) {
                    res.setHeader('Content-Type', 'application/pdf');
                    res.setHeader(
                        'Content-Disposition',
                        `inline; filename="${node.name}.pdf"`,
                    );
                    res.send(data);
                    return;
                }
            }

            res.status(404).json({
                error: ProviderErrorCodes.NOT_FOUND,
                message: 'File not available after materialization',
            });
        } catch (err) {
            logger.error('Error downloading file', { error: err, nodeId });
            res.status(404).json({
                error: ProviderErrorCodes.DOWNLOAD_FAILED,
                message: 'Failed to download file',
            });
        }
    } catch (error) {
        logger.error('Error getting node data', {
            error,
            nodeId: req.params.id,
        });
        res.status(500).json({ error: 'Failed to get node data' });
    }
});

// Materialize a node
router.post('/nodes/:id/materialize', async (req, res) => {
    try {
        if (!primaryProvider.isAuthenticated()) {
            res.status(401).json({ error: ProviderErrorCodes.AUTH_REQUIRED });
            return;
        }

        const nodeId = req.params.id;
        const node = await primaryProvider.materializeNode(nodeId);

        if (node === null) {
            res.status(422).json({
                error: 'UNSUPPORTED_RESOURCE',
                message: 'This resource is a page, not a downloadable file.',
            });
            return;
        }

        // Cache the node
        await remoteCache.cacheNode(node);

        res.json(node);
    } catch (error) {
        logger.error('Error materializing node', {
            error,
            nodeId: req.params.id,
        });
        res.status(500).json({ error: 'Failed to materialize node' });
    }
});

// Get courses (legacy)
router.get('/moodle/courses', async (_req, res) => {
    try {
        if (!primaryProvider.isAuthenticated()) {
            res.status(401).json({ error: ProviderErrorCodes.AUTH_REQUIRED });
            return;
        }

        const courses = await getMoodleCourses();
        res.json(courses);
    } catch (error) {
        logger.error('Error getting courses', { error });
        res.status(500).json({ error: 'Failed to get courses' });
    }
});

// Extract text from PDF node
router.get('/nodes/:id/text', async (req, res) => {
    try {
        if (!primaryProvider.isAuthenticated()) {
            res.status(401).json({ error: ProviderErrorCodes.AUTH_REQUIRED });
            return;
        }

        const nodeId = req.params.id;

        // Check if text is already cached
        if (textCache.has(nodeId)) {
            const cached = textCache.get(nodeId)!;
            res.json({
                text: cached.text,
                pages: cached.pages,
                method: cached.method,
                cached: true,
            });
            return;
        }

        // Get the PDF data (from cache or by downloading)
        let pdfData: Buffer | undefined;

        if (remoteCache.hasFile(nodeId)) {
            pdfData = remoteCache.getFile(nodeId) ?? undefined;
        }

        if (!pdfData) {
            // Need to materialize (download) the file first
            try {
                const node = await primaryProvider.materializeNode(nodeId);

                if (node === null) {
                    res.status(422).json({
                        error: 'UNSUPPORTED_RESOURCE',
                        message:
                            'This resource is a page, not a downloadable file.',
                    });
                    return;
                }

                // After materialization, get from cache
                if (remoteCache.hasFile(nodeId)) {
                    pdfData = remoteCache.getFile(nodeId) ?? undefined;
                }
            } catch (err) {
                logger.error('Error downloading file for text extraction', {
                    error: err,
                    nodeId,
                });
                res.status(404).json({
                    error: ProviderErrorCodes.DOWNLOAD_FAILED,
                    message: 'Failed to download file',
                });
                return;
            }
        }

        if (!pdfData) {
            res.status(404).json({
                error: ProviderErrorCodes.NOT_FOUND,
                message: 'File not available',
            });
            return;
        }

        // Extract text from PDF
        const result = await extractTextFromPdf(pdfData);

        // Cache the result
        textCache.set(nodeId, result);

        res.json({
            text: result.text,
            pages: result.pages,
            method: result.method,
            cached: false,
        });
    } catch (error) {
        logger.error('Error extracting text from node', {
            error,
            nodeId: req.params.id,
        });
        res.status(500).json({ error: 'Failed to extract text' });
    }
});

export default router;
