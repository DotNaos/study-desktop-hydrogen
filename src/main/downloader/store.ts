import { createLogger } from '@aryazos/ts-base/logging';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import sqlite3 from 'sqlite3';
import type { ExportMappingRecord, ExportStoreData, IgnoreRule } from './types';

const logger = createLogger('com.aryazos.study-sync.downloader.store');

const STORE_VERSION = 6 as const;
const STORE_FILE_NAME = 'mappings.sqlite';

type MappingRow = {
    remote_id: string;
    provider_id: string | null;
    relative_path: string | null;
    size: number | null;
    mtime_ms: number | null;
    inode: number | null;
    device_id: number | null;
    updated_at: number;
    last_synced_at: number | null;
};

type IgnoreRuleRow = {
    pattern: string;
    created_at: number;
};

function getExportDir(rootPath: string): string {
    return path.join(rootPath, '.aryazos');
}

function getStorePath(rootPath: string): string {
    return path.join(getExportDir(rootPath), STORE_FILE_NAME);
}

export async function ensureExportDir(rootPath: string): Promise<string> {
    const dir = getExportDir(rootPath);
    await fs.mkdir(dir, { recursive: true });
    return dir;
}

async function openDatabase(rootPath: string): Promise<sqlite3.Database> {
    const dir = getExportDir(rootPath);
    const dbPath = getStorePath(rootPath);
    const oldDbPath = path.join(dir, 'export.sqlite');

    // Migration: Rename export.sqlite -> mappings.sqlite if it exists and new one doesn't
    try {
        await fs.access(oldDbPath);
        // Old exists
        try {
            await fs.access(dbPath);
            // New also exists, ignore old
        } catch {
            // New doesn't exist, rename old
            logger.info('Renaming export.sqlite to mappings.sqlite');
            await fs.rename(oldDbPath, dbPath);
        }
    } catch {
        // Old doesn't exist, nothing to do
    }

    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (error) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(db);
        });
    });
}

async function closeDatabase(db: sqlite3.Database): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        db.close((error) => {
            if (error) {
                reject(error);
                return;
            }
            resolve();
        });
    });
}

async function execAsync(db: sqlite3.Database, sql: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        db.exec(sql, (error) => {
            if (error) {
                reject(error);
                return;
            }
            resolve();
        });
    });
}

async function runAsync(
    db: sqlite3.Database,
    sql: string,
    params?: any[],
): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        db.run(sql, params ?? [], (error) => {
            if (error) {
                reject(error);
                return;
            }
            resolve();
        });
    });
}

async function getAsync<T>(
    db: sqlite3.Database,
    sql: string,
    params?: any[],
): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
        db.get(sql, params ?? [], (error, row) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(row as T | undefined);
        });
    });
}

async function allAsync<T>(
    db: sqlite3.Database,
    sql: string,
    params?: any[],
): Promise<T[]> {
    return new Promise((resolve, reject) => {
        db.all(sql, params ?? [], (error, rows) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(rows as T[]);
        });
    });
}

async function initSchema(db: sqlite3.Database): Promise<void> {
    await execAsync(
        db,
        `
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;

      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS mappings (
        remote_id TEXT PRIMARY KEY,
        provider_id TEXT,
        relative_path TEXT,
        size INTEGER,
        mtime_ms INTEGER,
        inode INTEGER,
        device_id INTEGER,
        updated_at INTEGER NOT NULL,
        last_synced_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS ignore_rules (
        pattern TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL
      );
    `,
    );

    const versionRaw = await getMetaValue(db, 'version');
    const version = versionRaw ? Number(versionRaw) : null;

    if (!version) {
        await execAsync(
            db,
            'CREATE INDEX IF NOT EXISTS idx_mappings_inode ON mappings(inode, device_id)',
        );
        await setMetaValue(db, 'version', STORE_VERSION);
    } else if (version < STORE_VERSION) {
        logger.info('Migrating downloader store', {
            from: version,
            to: STORE_VERSION,
        });

        // v5 -> v6: removed remote_nodes table (now in userData/remote.sqlite)
        if (version < 6) {
            logger.info(
                'Migrating downloader store to v6 (remove remote_nodes)',
            );
            try {
                await execAsync(db, 'DROP TABLE IF EXISTS remote_nodes');
            } catch (e) {
                logger.warn(
                    'Failed to drop remote_nodes table during migration',
                    { error: e },
                );
            }
        }

        await setMetaValue(db, 'version', STORE_VERSION);
        await setMetaValue(db, 'updatedAt', Date.now());
    }
}

async function getMetaValue(
    db: sqlite3.Database,
    key: string,
): Promise<string | null> {
    const row = await getAsync<{ value?: string }>(
        db,
        'SELECT value FROM meta WHERE key = ?',
        [key],
    );
    return row?.value ?? null;
}

async function setMetaValue(
    db: sqlite3.Database,
    key: string,
    value: string | number,
): Promise<void> {
    await runAsync(
        db,
        'INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)',
        [key, String(value)],
    );
}

function mapRowToRecord(row: MappingRow): ExportMappingRecord {
    return {
        remoteId: row.remote_id,
        providerId: row.provider_id ?? undefined,
        relativePath: row.relative_path ?? undefined,
        size: row.size ?? undefined,
        mtimeMs: row.mtime_ms ?? undefined,
        inode: row.inode ?? undefined,
        deviceId: row.device_id ?? undefined,
        updatedAt: row.updated_at,
        lastSyncedAt: row.last_synced_at ?? undefined,
    };
}

function mapRecordToValues(
    record: ExportMappingRecord,
): Array<string | number | null> {
    return [
        record.remoteId,
        record.providerId ?? null,
        record.relativePath ?? null,
        record.size ?? null,
        record.mtimeMs ?? null,
        record.inode ?? null,
        record.deviceId ?? null,
        record.updatedAt,
        record.lastSyncedAt ?? null,
    ];
}

export async function loadExportStore(
    rootPath: string,
): Promise<ExportStoreData> {
    try {
        await ensureExportDir(rootPath);
        const db = await openDatabase(rootPath);
        try {
            await initSchema(db);

            const rows = await allAsync<MappingRow>(
                db,
                `SELECT
          remote_id,
          provider_id,
          relative_path,
          size,
          mtime_ms,
          inode,
          device_id,
          updated_at,
          last_synced_at
        FROM mappings
        ORDER BY updated_at DESC`,
            );

            const updatedAtRaw = await getMetaValue(db, 'updatedAt');
            const updatedAt = updatedAtRaw ? Number(updatedAtRaw) : Date.now();
            if (!updatedAtRaw) {
                await setMetaValue(db, 'updatedAt', updatedAt);
            }

            return {
                version: STORE_VERSION,
                updatedAt,
                mappings: rows.map(mapRowToRecord),
            };
        } finally {
            await closeDatabase(db);
        }
    } catch (error: any) {
        logger.error('Failed to read downloader store', { error });
        return createEmptyStore();
    }
}

export async function saveExportStore(
    rootPath: string,
    store: ExportStoreData,
): Promise<void> {
    await ensureExportDir(rootPath);
    const db = await openDatabase(rootPath);
    try {
        await initSchema(db);
        await execAsync(db, 'BEGIN IMMEDIATE;');

        await runAsync(db, 'DELETE FROM mappings;');
        const insertSql = `
      INSERT INTO mappings (
        remote_id,
        provider_id,
        relative_path,
        size,
        mtime_ms,
        inode,
        device_id,
        updated_at,
        last_synced_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?
      );
    `;

        for (const record of store.mappings) {
            await runAsync(db, insertSql, mapRecordToValues(record));
        }

        const now = Date.now();
        await setMetaValue(db, 'version', STORE_VERSION);
        await setMetaValue(db, 'updatedAt', now);
        await execAsync(db, 'COMMIT;');
    } catch (error) {
        try {
            await execAsync(db, 'ROLLBACK;');
        } catch (rollbackError) {
            logger.warn('Failed to rollback downloader store transaction', {
                error: rollbackError,
            });
        }
        throw error;
    } finally {
        await closeDatabase(db);
    }
}

export function createEmptyStore(): ExportStoreData {
    return {
        version: STORE_VERSION,
        updatedAt: Date.now(),
        mappings: [],
    };
}

export function upsertMapping(
    store: ExportStoreData,
    record: ExportMappingRecord,
): ExportStoreData {
    const now = Date.now();
    const next: ExportMappingRecord = {
        ...record,
        updatedAt: now,
    };

    const existingIndex = store.mappings.findIndex(
        (item) => item.remoteId === record.remoteId,
    );
    if (existingIndex >= 0) {
        const updated = [...store.mappings];
        updated[existingIndex] = { ...store.mappings[existingIndex], ...next };
        return {
            ...store,
            mappings: updated,
            updatedAt: now,
        };
    }

    return {
        ...store,
        mappings: [...store.mappings, next],
        updatedAt: now,
    };
}

export function removeMapping(
    store: ExportStoreData,
    remoteId: string,
): ExportStoreData {
    const next = store.mappings.filter(
        (record) => record.remoteId !== remoteId,
    );
    return {
        ...store,
        mappings: next,
        updatedAt: Date.now(),
    };
}

// ============================================================================
// Ignore Rules CRUD
// ============================================================================

function mapIgnoreRuleRowToRule(row: IgnoreRuleRow): IgnoreRule {
    return {
        pattern: row.pattern,
        createdAt: row.created_at,
    };
}

export async function listIgnoreRules(rootPath: string): Promise<IgnoreRule[]> {
    await ensureExportDir(rootPath);
    const db = await openDatabase(rootPath);
    try {
        await initSchema(db);
        const rows = await allAsync<IgnoreRuleRow>(
            db,
            'SELECT pattern, created_at FROM ignore_rules ORDER BY created_at DESC',
        );
        return rows.map(mapIgnoreRuleRowToRule);
    } finally {
        await closeDatabase(db);
    }
}

export async function addIgnoreRule(
    rootPath: string,
    rule: IgnoreRule,
): Promise<void> {
    await ensureExportDir(rootPath);
    const db = await openDatabase(rootPath);
    try {
        await initSchema(db);
        await runAsync(
            db,
            `INSERT OR IGNORE INTO ignore_rules (pattern, created_at)
       VALUES (?, ?)`,
            [rule.pattern, rule.createdAt],
        );
    } finally {
        await closeDatabase(db);
    }
}

export async function deleteIgnoreRule(
    rootPath: string,
    pattern: string,
): Promise<void> {
    await ensureExportDir(rootPath);
    const db = await openDatabase(rootPath);
    try {
        await initSchema(db);
        await runAsync(db, 'DELETE FROM ignore_rules WHERE pattern = ?', [
            pattern,
        ]);
    } finally {
        await closeDatabase(db);
    }
}

// ============================================================================
// Clear All Data
// ============================================================================

export async function clearAllData(rootPath: string): Promise<void> {
    await ensureExportDir(rootPath);
    const db = await openDatabase(rootPath);
    try {
        await initSchema(db);
        await execAsync(
            db,
            `
      DELETE FROM mappings;
      DELETE FROM ignore_rules;
    `,
        );
        await setMetaValue(db, 'updatedAt', Date.now());
        logger.info('Cleared all downloader data', { rootPath });
    } finally {
        await closeDatabase(db);
    }
}
