import { Router } from 'express';
import { join } from 'node:path';
import sqlite3 from 'sqlite3';
import { ensureStudySyncDataDir } from '../../../shared/paths';

const router = Router();
const dbPath = join(ensureStudySyncDataDir(), 'study-desktop.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS user_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        task_id TEXT NOT NULL,
        code TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, task_id)
      )
    `);
});

function getAttempt(userId: string, taskId: string): Promise<{ code: string } | null> {
    return new Promise((resolve, reject) => {
        db.get(
            'SELECT code FROM user_attempts WHERE user_id = ? AND task_id = ?',
            [userId, taskId],
            (error, row: { code: string } | undefined) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve(row ?? null);
            },
        );
    });
}

function upsertAttempt(userId: string, taskId: string, code: string): Promise<void> {
    return new Promise((resolve, reject) => {
        db.run(
            `
              INSERT INTO user_attempts (user_id, task_id, code)
              VALUES (?, ?, ?)
              ON CONFLICT(user_id, task_id) DO UPDATE SET
                code = excluded.code,
                timestamp = CURRENT_TIMESTAMP
            `,
            [userId, taskId, code],
            (error) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve();
            },
        );
    });
}

router.get('/task/:taskId/attempt', async (req, res) => {
    const taskId = String(req.params.taskId || '').trim();
    const userId = String(req.query.userId || '').trim();

    if (!taskId || !userId) {
        res.status(400).json({ error: 'taskId and userId are required' });
        return;
    }

    try {
        const attempt = await getAttempt(userId, taskId);
        res.json(attempt ?? { code: '' });
    } catch {
        res.status(500).json({ error: 'Failed to load attempt' });
    }
});

router.post('/task/:taskId/attempt', async (req, res) => {
    const taskId = String(req.params.taskId || '').trim();
    const userId = String((req.body as any)?.userId || '').trim();
    const code = String((req.body as any)?.code || '');

    if (!taskId || !userId) {
        res.status(400).json({ error: 'taskId and userId are required' });
        return;
    }

    try {
        await upsertAttempt(userId, taskId, code);
        res.json({ success: true });
    } catch {
        res.status(500).json({ error: 'Failed to persist attempt' });
    }
});

export default router;
