import { createLogger } from '@aryazos/ts-base/logging';
import type { ProviderNode } from '../../types';
import { buildPartitionRecords } from './builder';
import { TreeDatabase, allAsync, execAsync, getAsync, runAsync } from './db';
import { normalizeName } from './normalize';
import type {
    CalendarMatchRecord,
    PartitionUpdateResult,
    TreeNodeInput,
    TreeNodeRecord,
    TreeNodeView,
} from './types';

const logger = createLogger('com.aryazos.study-sync.tree.store');
function recordToView(record: TreeNodeRecord): TreeNodeView {
    const payload = record.payload_json ? JSON.parse(record.payload_json) : {};
    // Cast type to any to avoid conflict with Note type definition which doesn't include "folder"
    const type = (record.kind === 'folder' ? 'folder' : 'file') as any;
    const progress =
        record.kind === 'folder'
            ? undefined
            : typeof record.progress === 'number'
              ? clampProgress(record.progress)
              : undefined;
    const node: ProviderNode = {
        id: record.id,
        name: record.name,
        parent: record.parent_id ?? 'root',
        type,
        providerId: payload.providerId ?? 'moodle',
        fileExtension: payload.fileExtension,
        sourceUrl: payload.sourceUrl,
        group: payload.group,
        materialized: payload.materialized,
        readOnly: payload.readOnly,
        locked: payload.locked,
        mimeType: payload.mimeType,
        isGroup: payload.isGroup,
        progress,
    };
    return {
        ...node,
        hasChildren: record.has_children > 0,
    };
}

function clampProgress(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.min(Math.max(Math.round(value), 0), 100);
}

export class TreeStore {
    constructor(private readonly db: TreeDatabase) {}

    async reset(): Promise<void> {
        await this.db.reset();
    }

    async hasAnyNodes(): Promise<boolean> {
        return this.db.withDb(async (db) => {
            const row = await getAsync<{ count: number }>(
                db,
                'SELECT COUNT(*) as count FROM node',
            );
            return (row?.count ?? 0) > 0;
        });
    }

    async getRootNodes(includeGroups: boolean = true): Promise<TreeNodeView[]> {
        return this.db.withDb(async (db) => {
            const rows = await allAsync<TreeNodeRecord>(
                db,
                `
          SELECT node.*, progress.progress
          FROM node
          LEFT JOIN progress ON node.id = progress.node_id
          WHERE parent_id IS NULL
        `,
            );
            const nodes = rows.map(recordToView);
            if (includeGroups) return nodes;
            return this.flattenGroups(nodes);
        });
    }

    async getAllNodes(includeGroups: boolean = true): Promise<TreeNodeView[]> {
        return this.db.withDb(async (db) => {
            const rows = await allAsync<TreeNodeRecord>(
                db,
                `
          SELECT node.*, progress.progress
          FROM node
          LEFT JOIN progress ON node.id = progress.node_id
        `,
            );
            const nodes = rows.map(recordToView);
            if (includeGroups) return nodes;
            return this.flattenGroups(nodes);
        });
    }

    async getChildren(
        parentId: string,
        includeGroups: boolean = true,
    ): Promise<TreeNodeView[]> {
        return this.db.withDb(async (db) => {
            const rows = await allAsync<TreeNodeRecord>(
                db,
                `
          SELECT node.*, progress.progress
          FROM node
          LEFT JOIN progress ON node.id = progress.node_id
          WHERE parent_id = ?
        `,
                [parentId],
            );
            const nodes = rows.map(recordToView);
            if (includeGroups) return nodes;
            return this.flattenGroups(nodes);
        });
    }

    private async flattenGroups(
        nodes: TreeNodeView[],
    ): Promise<TreeNodeView[]> {
        let result: TreeNodeView[] = [];
        for (const node of nodes) {
            if (node.isGroup) {
                // Pass false to keep flattening recursively if nested groups exist
                const children = await this.getChildren(node.id, false);
                result = result.concat(children);
            } else {
                result.push(node);
            }
        }
        return result;
    }

    async getNode(id: string): Promise<TreeNodeView | null> {
        return this.db.withDb(async (db) => {
            const row = await getAsync<TreeNodeRecord>(
                db,
                `
          SELECT node.*, progress.progress
          FROM node
          LEFT JOIN progress ON node.id = progress.node_id
          WHERE id = ?
        `,
                [id],
            );
            return row ? recordToView(row) : null;
        });
    }

    async getPartitionRoot(id: string): Promise<TreeNodeRecord | null> {
        return this.db.withDb(async (db) => {
            const row = await getAsync<TreeNodeRecord>(
                db,
                'SELECT * FROM node WHERE id = ?',
                [id],
            );
            return row ?? null;
        });
    }

    async getPartitionRootIdForNode(nodeId: string): Promise<string | null> {
        return this.db.withDb(async (db) => {
            const row = await getAsync<{ partition_root_id: string }>(
                db,
                'SELECT partition_root_id FROM node WHERE id = ?',
                [nodeId],
            );
            return row?.partition_root_id ?? null;
        });
    }

    async updatePartitionCheck(
        partitionRootId: string,
        checkedAt: number,
    ): Promise<void> {
        return this.db.withDb(async (db) => {
            await runAsync(db, 'UPDATE node SET checked_at = ? WHERE id = ?', [
                checkedAt,
                partitionRootId,
            ]);
        });
    }

    async replacePartition(
        root: TreeNodeInput,
        fetchedAt: number = Date.now(),
        previousSubtreeHash?: string | null,
    ): Promise<PartitionUpdateResult> {
        const buildResult = buildPartitionRecords(root, fetchedAt);
        const { records, partitionRootId, subtreeHash } = buildResult;

        await this.db.withDb(async (db) => {
            await execAsync(db, 'BEGIN TRANSACTION');
            try {
                await execAsync(
                    db,
                    'CREATE TEMP TABLE temp_new_ids (id TEXT PRIMARY KEY)',
                );
                await execAsync(
                    db,
                    'CREATE TEMP TABLE temp_old_ids (id TEXT PRIMARY KEY)',
                );
                await runAsync(
                    db,
                    'INSERT INTO temp_old_ids SELECT id FROM node WHERE partition_root_id = ?',
                    [partitionRootId],
                );

                for (const record of records) {
                    await runAsync(
                        db,
                        `
              INSERT OR REPLACE INTO node (
                id, remote_key, parent_id, name, name_norm, kind, has_children, payload_json,
                checked_at, fetched_at, ttl_s, self_hash, subtree_hash, partition_root_id
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
                        [
                            record.id,
                            record.remote_key,
                            record.parent_id,
                            record.name,
                            record.name_norm,
                            record.kind,
                            record.has_children,
                            record.payload_json,
                            record.checked_at,
                            record.fetched_at,
                            record.ttl_s,
                            record.self_hash,
                            record.subtree_hash,
                            record.partition_root_id,
                        ],
                    );
                    await runAsync(
                        db,
                        'INSERT OR REPLACE INTO node_fts (id, name, name_norm) VALUES (?, ?, ?)',
                        [record.id, record.name, record.name_norm],
                    );
                    await runAsync(
                        db,
                        'INSERT OR REPLACE INTO temp_new_ids (id) VALUES (?)',
                        [record.id],
                    );
                }

                await runAsync(
                    db,
                    'DELETE FROM node WHERE partition_root_id = ? AND id NOT IN (SELECT id FROM temp_new_ids)',
                    [partitionRootId],
                );
                await runAsync(
                    db,
                    'DELETE FROM node_fts WHERE id IN (SELECT id FROM temp_old_ids WHERE id NOT IN (SELECT id FROM temp_new_ids))',
                    [],
                );

                await execAsync(db, 'DROP TABLE temp_new_ids');
                await execAsync(db, 'DROP TABLE temp_old_ids');
                await execAsync(db, 'COMMIT');
            } catch (error) {
                await execAsync(db, 'ROLLBACK');
                throw error;
            }
        });

        logger.info('Partition replaced', {
            partitionRootId,
            nodes: records.length,
        });

        return {
            partitionRootId,
            subtreeHash,
            changed: previousSubtreeHash
                ? previousSubtreeHash !== subtreeHash
                : true,
            fetchedAt,
        };
    }

    async search(query: string, limit: number): Promise<TreeNodeView[]> {
        const normalized = normalizeName(query);
        if (!normalized) {
            return [];
        }

        const tokens = normalized
            .split(/\s+/)
            .map((token) => `${token}*`)
            .join(' ');

        return this.db.withDb(async (db) => {
            const rows = await allAsync<TreeNodeRecord>(
                db,
                `
          SELECT node.*, progress.progress
          FROM node_fts
          JOIN node ON node_fts.id = node.id
          LEFT JOIN progress ON node.id = progress.node_id
          WHERE node_fts MATCH ?
          ORDER BY bm25(node_fts)
          LIMIT ?
        `,
                [tokens, limit],
            );
            return rows.map(recordToView);
        });
    }

    async listCalendarMatches(): Promise<CalendarMatchRecord[]> {
        return this.db.withDb(async (db) => {
            return allAsync<CalendarMatchRecord>(
                db,
                'SELECT * FROM calendar_match ORDER BY updated_at DESC',
            );
        });
    }

    async getCalendarMatch(
        calendarNameNorm: string,
    ): Promise<CalendarMatchRecord | null> {
        return this.db.withDb(async (db) => {
            const row = await getAsync<CalendarMatchRecord>(
                db,
                'SELECT * FROM calendar_match WHERE calendar_name_norm = ?',
                [calendarNameNorm],
            );
            return row ?? null;
        });
    }

    async upsertCalendarMatch(record: CalendarMatchRecord): Promise<void> {
        return this.db.withDb(async (db) => {
            await runAsync(
                db,
                `
          INSERT OR REPLACE INTO calendar_match (
            calendar_name_norm, calendar_name_raw, node_id, updated_at
          ) VALUES (?, ?, ?, ?)
        `,
                [
                    record.calendar_name_norm,
                    record.calendar_name_raw,
                    record.node_id,
                    record.updated_at,
                ],
            );
        });
    }

    async deleteCalendarMatch(calendarNameNorm: string): Promise<void> {
        return this.db.withDb(async (db) => {
            await runAsync(
                db,
                'DELETE FROM calendar_match WHERE calendar_name_norm = ?',
                [calendarNameNorm],
            );
        });
    }

    async setBatchProgress(updates: Record<string, number>): Promise<void> {
        return this.db.withDb(async (db) => {
            await execAsync(db, 'BEGIN TRANSACTION');
            try {
                const now = Date.now();
                for (const [nodeId, progress] of Object.entries(updates)) {
                    await runAsync(
                        db,
                        'INSERT OR REPLACE INTO progress (node_id, progress, updated_at) VALUES (?, ?, ?)',
                        [nodeId, clampProgress(Number(progress)), now],
                    );
                }
                await execAsync(db, 'COMMIT');
            } catch (error) {
                await execAsync(db, 'ROLLBACK');
                throw error;
            }
        });
    }
}
