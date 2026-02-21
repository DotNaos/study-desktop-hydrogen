import { createLogger } from '@aryazos/ts-base/logging';
import { Router } from 'express';
import {
    getVaultManifest,
    readVaultFile,
    VaultManifestEntry,
    writeVaultInkFile,
} from '../../vaultApi';

const logger = createLogger('com.aryazos.study-sync.server.vault');
const router = Router();

router.get('/manifest', async (_req, res) => {
    try {
        const entries: VaultManifestEntry[] = await getVaultManifest();
        res.json({
            entries,
            generatedAt: Date.now(),
        });
    } catch (error) {
        logger.error('Error building vault manifest', { error });
        res.status(500).json({ error: 'Failed to build vault manifest' });
    }
});

router.get('/file', async (req, res) => {
    try {
        const relativePath = String(req.query['path'] ?? '');
        const file = await readVaultFile(relativePath);
        if (!file) {
            res.status(404).json({ error: 'NOT_FOUND' });
            return;
        }

        res.setHeader('Content-Type', file.contentType);
        if (file.etag) res.setHeader('ETag', file.etag);
        res.setHeader('Cache-Control', 'no-store');
        file.stream.pipe(res);
    } catch (error) {
        logger.error('Error reading vault file', { error });
        res.status(500).json({ error: 'Failed to read vault file' });
    }
});

router.put('/file', async (req, res) => {
    try {
        const relativePath = String(req.query['path'] ?? '');
        const content = (req.body as any)?.content;
        const baseSha256 = (req.body as any)?.baseSha256 as string | undefined;

        if (typeof content !== 'string') {
            res.status(400).json({ error: 'INVALID_BODY' });
            return;
        }

        const result = await writeVaultInkFile(relativePath, {
            content,
            baseSha256,
        });

        if (result.kind === 'conflict') {
            res.status(409).json({
                error: 'CONFLICT',
                serverSha256: result.serverSha256,
                serverContent: result.serverContent,
            });
            return;
        }

        res.json({
            ok: true,
            sha256: result.sha256,
            mtimeMs: result.mtimeMs,
            size: result.size,
        });
    } catch (error) {
        logger.error('Error writing vault file', { error });
        res.status(500).json({ error: 'Failed to write vault file' });
    }
});

export default router;
