import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import sqlite3 from 'sqlite3';
import { createLogger } from '@aryazos/ts-base/logging';

const logger = createLogger('com.aryazos.study-sync.server.auth.userDb');

const DB_FILE = process.env.STUDY_SYNC_USER_DB || '/var/lib/aryazos-study-sync/users.sqlite';

export interface User {
    id: string;
    externalId: string;
    email: string | null;
    name: string | null;
    enabled: boolean;
    createdAt: number;
    lastSeenAt: number;
}

function ensureDbDir(): void {
    const dir = dirname(DB_FILE);
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
}

function openDatabase(): Promise<sqlite3.Database> {
    ensureDbDir();
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(DB_FILE, (error) => {
            if (error) reject(error);
            else resolve(db);
        });
    });
}

function closeDatabase(db: sqlite3.Database): Promise<void> {
    return new Promise((resolve, reject) => {
        db.close((error) => {
            if (error) reject(error);
            else resolve();
        });
    });
}

function runAsync(db: sqlite3.Database, sql: string, params: unknown[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
        db.run(sql, params, (error) => {
            if (error) reject(error);
            else resolve();
        });
    });
}

function getAsync<T>(db: sqlite3.Database, sql: string, params: unknown[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (error, row) => {
            if (error) reject(error);
            else resolve(row as T | undefined);
        });
    });
}

function allAsync<T>(db: sqlite3.Database, sql: string, params: unknown[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (error, rows) => {
            if (error) reject(error);
            else resolve((rows || []) as T[]);
        });
    });
}

async function initSchema(db: sqlite3.Database): Promise<void> {
    await runAsync(db, `
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            clerk_user_id TEXT NOT NULL UNIQUE,
            email TEXT,
            name TEXT,
            enabled INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL,
            last_seen_at INTEGER NOT NULL
        )
    `);
    await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_user_id)`);
}

let dbInitialized = false;

async function withDb<T>(fn: (db: sqlite3.Database) => Promise<T>): Promise<T> {
    const db = await openDatabase();
    try {
        if (!dbInitialized) {
            await initSchema(db);
            dbInitialized = true;
        }
        return await fn(db);
    } finally {
        await closeDatabase(db);
    }
}

interface DbUser {
    id: number;
    clerk_user_id: string;
    email: string | null;
    name: string | null;
    enabled: number;
    created_at: number;
    last_seen_at: number;
}

function mapDbUser(row: DbUser): User {
    return {
        id: String(row.id),
        externalId: row.clerk_user_id,
        email: row.email,
        name: row.name,
        enabled: row.enabled === 1,
        createdAt: row.created_at,
        lastSeenAt: row.last_seen_at,
    };
}

/**
 * Register or update a user on login attempt.
 * Creates user if not exists (enabled=false), updates lastSeenAt if exists.
 */
export async function registerLoginAttempt(
    externalId: string,
    email?: string | null,
    name?: string | null,
): Promise<User> {
    return withDb(async (db) => {
        const now = Date.now();
        const existing = await getAsync<DbUser>(
            db,
            'SELECT * FROM users WHERE clerk_user_id = ?',
            [externalId],
        );

        if (existing) {
            // Update last seen and optionally email/name
            await runAsync(
                db,
                `UPDATE users SET last_seen_at = ?, email = COALESCE(?, email), name = COALESCE(?, name) WHERE clerk_user_id = ?`,
                [now, email, name, externalId],
            );
            const updated = await getAsync<DbUser>(
                db,
                'SELECT * FROM users WHERE clerk_user_id = ?',
                [externalId],
            );
            logger.debug('Updated existing user', { externalId, enabled: updated?.enabled === 1 });
            return mapDbUser(updated!);
        }

        // New user - insert with enabled=false
        await runAsync(
            db,
            `INSERT INTO users (clerk_user_id, email, name, enabled, created_at, last_seen_at) VALUES (?, ?, ?, 0, ?, ?)`,
            [externalId, email || null, name || null, now, now],
        );
        const created = await getAsync<DbUser>(
            db,
            'SELECT * FROM users WHERE clerk_user_id = ?',
            [externalId],
        );
        logger.info('Registered new user (disabled by default)', { externalId, email });
        return mapDbUser(created!);
    });
}

/**
 * Check if a user is enabled.
 */
export async function isUserEnabled(externalId: string): Promise<boolean> {
    return withDb(async (db) => {
        const user = await getAsync<DbUser>(
            db,
            'SELECT enabled FROM users WHERE clerk_user_id = ?',
            [externalId],
        );
        return user?.enabled === 1;
    });
}

/**
 * Get a user by external ID.
 */
export async function getUserByExternalId(externalId: string): Promise<User | null> {
    return withDb(async (db) => {
        const user = await getAsync<DbUser>(
            db,
            'SELECT * FROM users WHERE clerk_user_id = ?',
            [externalId],
        );
        return user ? mapDbUser(user) : null;
    });
}

/**
 * Get all users.
 */
export async function getAllUsers(): Promise<User[]> {
    return withDb(async (db) => {
        const users = await allAsync<DbUser>(db, 'SELECT * FROM users ORDER BY last_seen_at DESC');
        return users.map(mapDbUser);
    });
}

/**
 * Enable or disable a user.
 */
export async function setUserEnabled(externalId: string, enabled: boolean): Promise<User | null> {
    return withDb(async (db) => {
        await runAsync(
            db,
            'UPDATE users SET enabled = ? WHERE clerk_user_id = ?',
            [enabled ? 1 : 0, externalId],
        );
        const user = await getAsync<DbUser>(
            db,
            'SELECT * FROM users WHERE clerk_user_id = ?',
            [externalId],
        );
        if (user) {
            logger.info('User access updated', { externalId, enabled });
            return mapDbUser(user);
        }
        return null;
    });
}

/**
 * Delete a user.
 */
export async function deleteUser(externalId: string): Promise<boolean> {
    return withDb(async (db) => {
        const existing = await getAsync<DbUser>(
            db,
            'SELECT * FROM users WHERE clerk_user_id = ?',
            [externalId],
        );
        if (!existing) return false;

        await runAsync(db, 'DELETE FROM users WHERE clerk_user_id = ?', [externalId]);
        logger.info('User deleted', { externalId });
        return true;
    });
}
