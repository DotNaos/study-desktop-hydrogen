/**
 * Remote Cache Manager using SQLite.
 *
 * Stores remote node metadata in a SQLite database for fast querying.
 * Located in ~/.aryazos/study-sync/cache (or ARYAZOS_STUDY_SYNC_DATA_DIR/cache).
 */

import { createLogger } from '@aryazos/ts-base/logging';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import sqlite3 from "sqlite3";
import { ensureStudySyncCacheDir, getStudySyncCacheDir } from "../shared/paths";

const logger = createLogger("com.aryazos.study-sync.remoteCache");

const CACHE_VERSION = 1;
const DB_FILE_NAME = "remote.sqlite";

// ============================================================================
// Types
// ============================================================================

export interface CachedRemoteNode {
  id: string;
  name: string;
  parent: string | null;
  type: "folder" | "file";
  providerId: string;
  fileExtension?: string;
  sourceUrl?: string;
  groupName?: string;
  indexedAt: number;
}

// ============================================================================
// SQLite Helpers
// ============================================================================

function getDbPath(): string {
  return join(getStudySyncCacheDir(), DB_FILE_NAME);
}

function getFilesDir(): string {
  return join(getStudySyncCacheDir(), "files");
}

async function openDatabase(): Promise<sqlite3.Database> {
  const dbPath = getDbPath();
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (error) => {
      if (error) reject(error);
      else resolve(db);
    });
  });
}

async function closeDatabase(db: sqlite3.Database): Promise<void> {
  return new Promise((resolve, reject) => {
    db.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function execAsync(db: sqlite3.Database, sql: string): Promise<void> {
  return new Promise((resolve, reject) => {
    db.exec(sql, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function runAsync(db: sqlite3.Database, sql: string, params?: any[]): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(sql, params || [], (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function getAsync<T>(db: sqlite3.Database, sql: string, params?: any[]): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, params || [], (error, row) => {
      if (error) reject(error);
      else resolve(row as T | undefined);
    });
  });
}

async function allAsync<T>(db: sqlite3.Database, sql: string, params?: any[]): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params || [], (error, rows) => {
      if (error) reject(error);
      else resolve((rows || []) as T[]);
    });
  });
}

// ============================================================================
// Schema
// ============================================================================

async function initSchema(db: sqlite3.Database): Promise<void> {
  await execAsync(db, `
    CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      parent TEXT,
      type TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      file_extension TEXT,
      source_url TEXT,
      group_name TEXT,
      indexed_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_nodes_parent ON nodes(parent);
    CREATE INDEX IF NOT EXISTS idx_nodes_provider ON nodes(provider_id);

    CREATE TABLE IF NOT EXISTS sync_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Check/set version
  const version = await getAsync<{ value: string }>(db, "SELECT value FROM sync_meta WHERE key = 'version'");
  if (!version) {
    await runAsync(db, "INSERT INTO sync_meta (key, value) VALUES ('version', ?)", [String(CACHE_VERSION)]);
  }
}

// ============================================================================
// Remote Cache Manager
// ============================================================================

class RemoteCacheManager {
  private filesDir: string;
  private initialized = false;

  constructor() {
    ensureStudySyncCacheDir();
    this.filesDir = getFilesDir();
    if (!existsSync(this.filesDir)) {
      mkdirSync(this.filesDir, { recursive: true });
      logger.info("Created files cache directory", { path: this.filesDir });
    }
  }

  private async withDb<T>(fn: (db: sqlite3.Database) => Promise<T>): Promise<T> {
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

  // ==================== Node Operations ====================

  async getNode(id: string): Promise<CachedRemoteNode | null> {
    return this.withDb(async (db) => {
      const row = await getAsync<any>(db, "SELECT * FROM nodes WHERE id = ?", [id]);
      return row ? this.rowToNode(row) : null;
    });
  }

  async setNode(node: CachedRemoteNode): Promise<void> {
    return this.withDb(async (db) => {
      await runAsync(db, `
        INSERT OR REPLACE INTO nodes (id, name, parent, type, provider_id, file_extension, source_url, group_name, indexed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        node.id,
        node.name,
        node.parent,
        node.type,
        node.providerId,
        node.fileExtension ?? null,
        node.sourceUrl ?? null,
        node.groupName ?? null,
        node.indexedAt,
      ]);
    });
  }

  /**
   * Cache a ProviderNode-like object (automatically adds indexedAt).
   */
  async cacheNode(node: any): Promise<void> {
    const cached: CachedRemoteNode = {
      id: node.id,
      name: node.name,
      parent: node.parent ?? null,
      type: node.type === "folder" || node.type === "composite" ? "folder" : "file",
      providerId: node.providerId ?? "moodle",
      fileExtension: node.fileExtension,
      sourceUrl: node.sourceUrl,
      groupName: node.group,
      indexedAt: Date.now(),
    };
    await this.setNode(cached);
  }

  async setNodes(nodes: CachedRemoteNode[]): Promise<void> {
    if (nodes.length === 0) return;

    return this.withDb(async (db) => {
      await execAsync(db, "BEGIN TRANSACTION");
      try {
        for (const node of nodes) {
          await runAsync(db, `
            INSERT OR REPLACE INTO nodes (id, name, parent, type, provider_id, file_extension, source_url, group_name, indexed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            node.id,
            node.name,
            node.parent,
            node.type,
            node.providerId,
            node.fileExtension ?? null,
            node.sourceUrl ?? null,
            node.groupName ?? null,
            node.indexedAt,
          ]);
        }
        await execAsync(db, "COMMIT");
      } catch (error) {
        await execAsync(db, "ROLLBACK");
        throw error;
      }
    });
  }

  async getAllNodes(): Promise<CachedRemoteNode[]> {
    return this.withDb(async (db) => {
      const rows = await allAsync<any>(db, "SELECT * FROM nodes");
      return rows.map(r => this.rowToNode(r));
    });
  }

  async getNodesByProvider(providerId: string): Promise<CachedRemoteNode[]> {
    return this.withDb(async (db) => {
      const rows = await allAsync<any>(db, "SELECT * FROM nodes WHERE provider_id = ?", [providerId]);
      return rows.map(r => this.rowToNode(r));
    });
  }

  async getChildren(parentId: string): Promise<CachedRemoteNode[]> {
    return this.withDb(async (db) => {
      const rows = await allAsync<any>(db, "SELECT * FROM nodes WHERE parent = ?", [parentId]);
      return rows.map(r => this.rowToNode(r));
    });
  }

  async searchNodes(query: string, providerId?: string): Promise<CachedRemoteNode[]> {
    return this.withDb(async (db) => {
      const likeQuery = `%${query}%`;
      const sql = providerId
        ? "SELECT * FROM nodes WHERE name LIKE ? AND provider_id = ? LIMIT 50"
        : "SELECT * FROM nodes WHERE name LIKE ? LIMIT 50";
      const params = providerId ? [likeQuery, providerId] : [likeQuery];
      const rows = await allAsync<any>(db, sql, params);
      return rows.map(r => this.rowToNode(r));
    });
  }

  // ==================== Children Operations (Compatibility) ====================

  /**
   * Check if any children exist for a parent.
   */
  async hasChildren(parentId: string): Promise<boolean> {
    return this.withDb(async (db) => {
      const result = await getAsync<{ count: number }>(db, "SELECT COUNT(*) as count FROM nodes WHERE parent = ?", [parentId]);
      return (result?.count ?? 0) > 0;
    });
  }

  /**
   * Cache children for a parent (stores each node with parent FK).
   * Accepts ProviderNode-like objects and adds indexedAt automatically.
   */
  async setChildren(parentId: string, children: any[]): Promise<void> {
    if (children.length === 0) return;

    const now = Date.now();
    const nodes: CachedRemoteNode[] = children.map(c => ({
      id: c.id,
      name: c.name,
      parent: parentId,
      type: c.type === "folder" || c.type === "composite" ? "folder" : "file",
      providerId: c.providerId ?? "moodle",
      fileExtension: c.fileExtension,
      sourceUrl: c.sourceUrl,
      groupName: c.group,
      indexedAt: now,
    }));

    await this.setNodes(nodes);
  }

  /**
   * Clear cached children for a parent.
   */
  async clearChildren(parentId: string): Promise<void> {
    return this.withDb(async (db) => {
      await runAsync(db, "DELETE FROM nodes WHERE parent = ?", [parentId]);
    });
  }

  // ==================== File Operations ====================

  getFilePath(nodeId: string, extension: string = "pdf"): string {
    return join(this.filesDir, `${nodeId}.${extension}`);
  }

  hasFile(nodeId: string, extension: string = "pdf"): boolean {
    return existsSync(this.getFilePath(nodeId, extension));
  }

  getFile(nodeId: string, extension: string = "pdf"): Buffer | null {
    const path = this.getFilePath(nodeId, extension);
    if (!existsSync(path)) {
      return null;
    }
    return readFileSync(path);
  }

  setFile(nodeId: string, data: Buffer, extension: string = "pdf"): string {
    const path = this.getFilePath(nodeId, extension);
    writeFileSync(path, data);
    logger.info("Cached file", { nodeId, path, size: data.length });
    return path;
  }

  // ==================== Utility ====================

  async clearProvider(providerId: string): Promise<void> {
    return this.withDb(async (db) => {
      await runAsync(db, "DELETE FROM nodes WHERE provider_id = ?", [providerId]);
      logger.info("Cleared provider cache", { providerId });
    });
  }

  async clearAll(): Promise<void> {
    return this.withDb(async (db) => {
      await runAsync(db, "DELETE FROM nodes");
      logger.info("Cleared all node cache");
    });
  }

  async getStats(): Promise<{ nodes: number; files: number }> {
    const nodeCount = await this.withDb(async (db) => {
      const result = await getAsync<{ count: number }>(db, "SELECT COUNT(*) as count FROM nodes");
      return result?.count ?? 0;
    });

    const fileCount = existsSync(this.filesDir)
      ? readdirSync(this.filesDir).length
      : 0;

    return { nodes: nodeCount, files: fileCount };
  }

  private rowToNode(row: any): CachedRemoteNode {
    return {
      id: row.id,
      name: row.name,
      parent: row.parent,
      type: row.type,
      providerId: row.provider_id,
      fileExtension: row.file_extension || undefined,
      sourceUrl: row.source_url || undefined,
      groupName: row.group_name || undefined,
      indexedAt: row.indexed_at,
    };
  }
}

// Singleton instance
export const remoteCache = new RemoteCacheManager();
