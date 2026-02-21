import { createLogger } from '@aryazos/ts-base/logging';
import { Router } from 'express';
import { promises as fs } from 'node:fs';
import {
    buildIndex,
    createDefaultRecord,
    deleteMapping,
    downloadMappedNode,
    downloadRemoteNodeRecursive,
    getExportRoot,
    getMappingStatuses,
    listMappings,
    resolveAbsolutePath,
    saveMapping,
    setExportRoot,
} from '../../downloader';
import { primaryProvider } from '../../providers';
import { ProviderErrorCodes } from '../../types';

// Dynamic imports are handled inside routes if needed, but since we are refactoring,
// we can likely use static imports if we solve the circular deps or if downloader module is safe.
// Original server.ts had dynamic imports for downloader methods sometimes, but also static imports.
// It seems it used static imports for most functions at the top, but dynamic imports for some actions?
// Actually lines 8-19 imported from "./downloader" statically.
// But endpoints lines 750, 765, 781, 808, 828, 843, 877, 945 use dynamic imports.
// This might be for lazy loading or reducing startup time, or circular deps.
// Given we moved this to a route file, static imports are cleaner if possible.
// I will use dynamic imports where the original used them to be safe, or stick to static if 'downloader' index exports them.
// Wait, the original had mixed usage.
// I will use static imports for what is already imported.
// For 'renameLocalFile', 'listIgnoreRules' etc. which appeared in dynamic imports:
// I should import them statically if they are exported from 'downloader/index'.
// I'll check if they are exported.
// Previously I assumed they are.

import {
    addIgnoreRule,
    clearAllMappingsAndRules,
    deleteIgnoreRule,
    listIgnoreRules,
    renameLocalFile,
} from '../../downloader';
import { fetchPredictions } from '../../downloader/predictions';

const logger = createLogger('com.aryazos.study-sync.server.downloader');
const router = Router();

// Export root path
router.get('/root', (_req, res) => {
    res.json({ rootPath: getExportRoot() });
});

router.post('/root', async (req, res) => {
    const rootPath = String(req.body?.rootPath || '');
    if (!rootPath) {
        res.status(400).json({ error: 'INVALID_ROOT' });
        return;
    }

    try {
        await setExportRoot(rootPath);
        res.json({ rootPath });
    } catch (error) {
        logger.error('Failed to set export root', { error, rootPath });
        res.status(400).json({ error: 'EXPORT_ROOT_INVALID' });
    }
});

// Mappings
router.get('/mappings', async (_req, res) => {
    try {
        const mappings = await listMappings();
        res.json({ mappings });
    } catch (error) {
        logger.error('Failed to list export mappings', { error });
        res.status(400).json({ error: 'EXPORT_ROOT_REQUIRED' });
    }
});

router.post('/mappings', async (req, res) => {
    const remoteId = String(req.body?.remoteId || '');
    const relativePath = String(req.body?.relativePath || '').trim();

    if (!remoteId || !relativePath) {
        res.status(400).json({ error: 'INVALID_MAPPING' });
        return;
    }

    try {
        let stats = {};
        try {
            const absPath = resolveAbsolutePath(relativePath);
            const stat = await fs.stat(absPath);
            stats = {
                size: stat.size,
                mtimeMs: stat.mtimeMs,
                inode: Number(stat.ino),
                deviceId: Number(stat.dev),
            };
        } catch (error) {
            // File doesn't exist yet, that's fine
        }

        const record: any = createDefaultRecord({
            remoteId,
            relativePath,
            providerId: primaryProvider.id,
        });

        Object.assign(record, stats);

        await saveMapping(record);
        res.json({ mapping: record });
    } catch (error) {
        logger.error('Failed to save export mapping', { error });
        res.status(400).json({ error: 'EXPORT_ROOT_REQUIRED' });
    }
});

router.delete('/mappings/:id', async (req, res) => {
    try {
        await deleteMapping(req.params.id);
        res.json({ ok: true });
    } catch (error) {
        logger.error('Failed to delete export mapping', { error });
        res.status(400).json({ error: 'EXPORT_ROOT_REQUIRED' });
    }
});

// Scan
router.post('/scan', async (_req, res) => {
    try {
        const index = await buildIndex();
        const mappings = await getMappingStatuses();
        res.json({
            rootPath: getExportRoot(),
            generatedAt: Date.now(),
            files: index.files,
            folders: index.folders,
            mappings,
        });
    } catch (error) {
        logger.error('Failed to scan export root', { error });
        res.status(400).json({ error: 'EXPORT_ROOT_REQUIRED' });
    }
});

// Download
router.post('/download', async (req, res) => {
    const remoteId = String(req.body?.remoteId || '');
    const relativePath = req.body?.relativePath
        ? String(req.body.relativePath)
        : undefined;
    const overwrite = Boolean(req.body?.overwrite);

    if (!remoteId) {
        res.status(400).json({ error: 'INVALID_MAPPING' });
        return;
    }

    try {
        const result = await downloadMappedNode({
            remoteId,
            relativePath,
            overwrite,
        });
        res.json(result);
    } catch (error: any) {
        const message = error instanceof Error ? error.message : String(error);
        if (message === 'AUTH_REQUIRED') {
            res.status(401).json({ error: ProviderErrorCodes.AUTH_REQUIRED });
            return;
        }
        if (message === 'EXPORT_ROOT_REQUIRED') {
            res.status(400).json({ error: 'EXPORT_ROOT_REQUIRED' });
            return;
        }
        if (message === 'EXPORT_MAPPING_REQUIRED') {
            res.status(400).json({ error: 'EXPORT_MAPPING_REQUIRED' });
            return;
        }
        if (message === 'EXPORT_PATH_REQUIRED') {
            res.status(400).json({ error: 'EXPORT_PATH_REQUIRED' });
            return;
        }
        if (message === 'EXPORT_NODE_UNSUPPORTED') {
            res.status(422).json({ error: 'EXPORT_NODE_UNSUPPORTED' });
            return;
        }
        if (message === 'EXPORT_FILE_MISSING') {
            res.status(404).json({ error: 'EXPORT_FILE_MISSING' });
            return;
        }
        if (message === 'EXPORT_PATH_OUTSIDE_ROOT') {
            res.status(400).json({ error: 'EXPORT_PATH_OUTSIDE_ROOT' });
            return;
        }
        logger.error('Failed to export download', { error, remoteId });
        res.status(500).json({ error: 'EXPORT_DOWNLOAD_FAILED' });
    }
});

// Recursive Download
router.post('/download-recursive', async (req, res) => {
    const { remoteId, relativePath, overwrite } = req.body;
    if (!remoteId || !relativePath) {
        res.status(400).json({
            error: 'MISSING_PARAMS',
            message: 'remoteId and relativePath are required',
        });
        return;
    }
    try {
        await downloadRemoteNodeRecursive(remoteId, relativePath, {
            overwrite,
        });
        res.json({ success: true });
    } catch (err: any) {
        logger.error('Recursive download failed', { error: err, remoteId });
        res.status(500).json({ error: err.message || 'DOWNLOAD_FAILED' });
    }
});

// Rename
router.post('/rename', async (req, res) => {
    const oldPath = String(req.body?.oldPath || '');
    const newPath = String(req.body?.newPath || '');

    if (!oldPath || !newPath) {
        res.status(400).json({ error: 'INVALID_PATHS' });
        return;
    }

    try {
        await renameLocalFile(oldPath, newPath);
        res.json({ ok: true });
    } catch (error: any) {
        logger.error('Failed to rename local file', {
            error,
            oldPath,
            newPath,
        });
        res.status(500).json({ error: error.message || 'RENAME_FAILED' });
    }
});

// Ignore Rules
router.get('/ignore-rules', async (_req, res) => {
    try {
        const rootPath = getExportRoot();
        if (!rootPath) {
            res.status(400).json({ error: 'EXPORT_ROOT_REQUIRED' });
            return;
        }
        const rules = await listIgnoreRules(rootPath);
        res.json({ rules });
    } catch (error) {
        logger.error('Failed to list ignore rules', { error });
        res.status(500).json({ error: 'IGNORE_RULES_FAILED' });
    }
});

router.post('/ignore-rules', async (req, res) => {
    try {
        const rootPath = getExportRoot();
        if (!rootPath) {
            res.status(400).json({ error: 'EXPORT_ROOT_REQUIRED' });
            return;
        }

        const rule = {
            pattern: req.body?.pattern,
            createdAt: Date.now(),
        };

        if (!rule.pattern) {
            res.status(400).json({ error: 'INVALID_RULE' });
            return;
        }

        await addIgnoreRule(rootPath, rule);
        res.json({ rule });
    } catch (error) {
        logger.error('Failed to add ignore rule', { error });
        res.status(500).json({ error: 'IGNORE_RULE_FAILED' });
    }
});

router.delete('/ignore-rules/:id', async (req, res) => {
    try {
        const rootPath = getExportRoot();
        if (!rootPath) {
            res.status(400).json({ error: 'EXPORT_ROOT_REQUIRED' });
            return;
        }
        await deleteIgnoreRule(rootPath, req.params.id);
        res.json({ ok: true });
    } catch (error) {
        logger.error('Failed to delete ignore rule', { error });
        res.status(500).json({ error: 'IGNORE_RULE_FAILED' });
    }
});

// Clear Data
router.post('/clear', async (_req, res) => {
    try {
        await clearAllMappingsAndRules();
        res.json({ ok: true });
    } catch (error) {
        logger.error('Failed to clear export data', { error });
        res.status(500).json({ error: 'CLEAR_FAILED' });
    }
});

// Predictions
router.post('/predict', async (req, res) => {
    try {
        const localName = String(req.body?.localName || '');
        const parentRemoteId = req.body?.parentRemoteId;

        if (!localName) {
            res.status(400).json({ error: 'INVALID_LOCAL_NAME' });
            return;
        }

        const predictions = await fetchPredictions(
            localName,
            [],
            parentRemoteId,
        );
        res.json({ predictions });
    } catch (error) {
        logger.error('Failed to generate predictions', { error });
        res.status(500).json({ error: 'PREDICTION_FAILED' });
    }
});

export default router;
