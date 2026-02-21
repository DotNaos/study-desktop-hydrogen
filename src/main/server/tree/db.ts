import { join } from "node:path";
import sqlite3 from "sqlite3";
import { ensureStudySyncCacheDir, getStudySyncCacheDir } from "../../../shared/paths";

const SCHEMA_VERSION = 4;
const DB_FILE_NAME = "tree.sqlite";

export interface SqliteDatabase {
  exec(sql: string, callback?: (error: Error | null) => void): void;
  run(sql: string, params: unknown[], callback?: (error: Error | null) => void): void;
  get<T>(sql: string, params: unknown[], callback?: (error: Error | null, row?: T) => void): void;
  all<T>(sql: string, params: unknown[], callback?: (error: Error | null, rows?: T[]) => void): void;
  close(callback?: (error: Error | null) => void): void;
}

function getDbPath(): string {
  ensureStudySyncCacheDir();
  return join(getStudySyncCacheDir(), DB_FILE_NAME);
}

function openDatabase(): Promise<sqlite3.Database> {
  const dbPath = getDbPath();
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (error) => {
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

export function execAsync(db: SqliteDatabase, sql: string): Promise<void> {
  return new Promise((resolve, reject) => {
    db.exec(sql, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

export function runAsync(db: SqliteDatabase, sql: string, params: unknown[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

export function getAsync<T>(db: SqliteDatabase, sql: string, params: unknown[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get<T>(sql, params, (error, row) => {
      if (error) reject(error);
      else resolve(row as T | undefined);
    });
  });
}

export function allAsync<T>(db: SqliteDatabase, sql: string, params: unknown[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all<T>(sql, params, (error, rows) => {
      if (error) reject(error);
      else resolve((rows || []) as T[]);
    });
  });
}

async function initSchema(db: SqliteDatabase): Promise<void> {
  await execAsync(db, `
    CREATE TABLE IF NOT EXISTS node (
      id TEXT PRIMARY KEY,
      remote_key TEXT NOT NULL UNIQUE,
      parent_id TEXT,
      name TEXT NOT NULL,
      name_norm TEXT NOT NULL,
      kind TEXT NOT NULL,
      has_children INTEGER NOT NULL DEFAULT 0,
      payload_json TEXT,
      checked_at INTEGER,
      fetched_at INTEGER,
      ttl_s INTEGER NOT NULL DEFAULT 3600,
      self_hash TEXT NOT NULL,
      subtree_hash TEXT NOT NULL,
      partition_root_id TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_node_parent ON node(parent_id);
    CREATE INDEX IF NOT EXISTS idx_node_partition ON node(partition_root_id);
    CREATE INDEX IF NOT EXISTS idx_node_name_norm ON node(name_norm);

    CREATE TABLE IF NOT EXISTS calendar_match (
      calendar_name_norm TEXT PRIMARY KEY,
      calendar_name_raw TEXT NOT NULL,
      node_id TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS node_fts USING fts5(
      id UNINDEXED,
      name,
      name_norm
    );

    CREATE TABLE IF NOT EXISTS progress (
      node_id TEXT PRIMARY KEY,
      progress INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  const versionRow = await getAsync<{ value: string }>(db, "SELECT value FROM sync_meta WHERE key = 'version'");
  const currentVersion = versionRow ? Number.parseInt(versionRow.value, 10) : 0;

  if (currentVersion < 4) {
    await execAsync(db, `
      CREATE TABLE IF NOT EXISTS progress (
        node_id TEXT PRIMARY KEY,
        progress INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL
      );
    `);

    const completionTable = await getAsync<{ name: string }>(
      db,
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'completion'"
    );

    if (completionTable) {
      await execAsync(db, `
        INSERT OR REPLACE INTO progress (node_id, progress, updated_at)
        SELECT node_id,
               CASE WHEN is_completed = 1 THEN 100 ELSE 0 END,
               updated_at
        FROM completion
      `);
      await execAsync(db, "DROP TABLE IF EXISTS completion;");
    }

    if (!versionRow) {
      await runAsync(db, "INSERT INTO sync_meta (key, value) VALUES ('version', ?)", [String(SCHEMA_VERSION)]);
    } else {
      await runAsync(db, "UPDATE sync_meta SET value = ? WHERE key = 'version'", [String(SCHEMA_VERSION)]);
    }
  }
}

async function dropAll(db: SqliteDatabase): Promise<void> {
  await execAsync(db, `
    DROP TABLE IF EXISTS node;
    DROP TABLE IF EXISTS calendar_match;
    DROP TABLE IF EXISTS node_fts;
    DROP TABLE IF EXISTS progress;
    DROP TABLE IF EXISTS sync_meta;
  `);
}

export class TreeDatabase {
  private initialized = false;

  async withDb<T>(fn: (db: sqlite3.Database) => Promise<T>): Promise<T> {
    const db = await openDatabase();
    if (!this.initialized) {
      await initSchema(db);
      this.initialized = true;
    }
    try {
      return await fn(db);
    } finally {
      await closeDatabase(db);
    }
  }

  async reset(): Promise<void> {
    await this.withDb(async (db) => {
      await dropAll(db);
      await initSchema(db);
      this.initialized = true;
    });
  }
}
