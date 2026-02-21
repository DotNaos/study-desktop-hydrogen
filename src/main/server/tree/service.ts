import { createLogger } from '@aryazos/ts-base/logging';
import { buildPartitionRecords } from './builder';
import { TreeDatabase } from './db';
import { TreeEventBus } from './events';
import type { TreeProvider } from './provider';
import { TreeStore } from './store';
import type { PartitionUpdateResult } from './types';

const logger = createLogger('com.aryazos.study-sync.tree.service');

interface RefreshOptions {
    force?: boolean;
}

export class TreeService {
    private readonly db = new TreeDatabase();
    readonly store = new TreeStore(this.db);
    private readonly refreshInFlight = new Map<
        string,
        Promise<PartitionUpdateResult | null>
    >();

    constructor(
        private readonly provider: TreeProvider,
        private readonly events: TreeEventBus,
    ) {}

    async ensureBuilt(): Promise<void> {
        if (!this.provider.isAuthenticated()) {
            return;
        }

        const hasNodes = await this.store.hasAnyNodes();
        if (!hasNodes) {
            logger.info('Tree cache empty, performing full rebuild');
            await this.fullRebuild();
        }
    }

    async fullRebuild(): Promise<void> {
        if (!this.provider.isAuthenticated()) {
            throw new Error('Provider not authenticated');
        }

        await this.store.reset();
        const roots = await this.provider.listPartitionRoots();
        for (const root of roots) {
            const subtree = await this.provider.fetchSubtree(root.remoteKey);
            await this.store.replacePartition(subtree, Date.now());
        }
    }

    async refreshPartitionForNode(
        nodeId: string,
        options: RefreshOptions = {},
    ): Promise<PartitionUpdateResult | null> {
        const partitionRootId =
            await this.store.getPartitionRootIdForNode(nodeId);
        if (!partitionRootId) {
            return null;
        }
        return this.refreshPartition(partitionRootId, options);
    }

    async refreshPartition(
        partitionRootId: string,
        options: RefreshOptions = {},
    ): Promise<PartitionUpdateResult | null> {
        const existing = this.refreshInFlight.get(partitionRootId);
        if (existing) {
            return existing;
        }

        const task = this.refreshPartitionInternal(partitionRootId, options)
            .catch((error) => {
                logger.warn('Partition refresh failed', {
                    error,
                    partitionRootId,
                });
                return null;
            })
            .finally(() => {
                this.refreshInFlight.delete(partitionRootId);
            });

        this.refreshInFlight.set(partitionRootId, task);
        return task;
    }

    private async refreshPartitionInternal(
        partitionRootId: string,
        options: RefreshOptions,
    ): Promise<PartitionUpdateResult | null> {
        if (!this.provider.isAuthenticated()) {
            return null;
        }

        const partitionRoot =
            await this.store.getPartitionRoot(partitionRootId);
        if (!partitionRoot) {
            return null;
        }

        const now = Date.now();
        const lastChecked = partitionRoot.checked_at ?? 0;
        const ttlMs = (partitionRoot.ttl_s ?? 3600) * 1000;
        const shouldRefresh = options.force || now - lastChecked > ttlMs;

        if (!shouldRefresh) {
            return {
                partitionRootId,
                subtreeHash: partitionRoot.subtree_hash,
                changed: false,
                fetchedAt: partitionRoot.fetched_at ?? now,
            };
        }

        const subtree = await this.provider.fetchSubtree(
            partitionRoot.remote_key,
        );
        const preview = buildPartitionRecords(subtree, now);

        if (preview.subtreeHash === partitionRoot.subtree_hash) {
            await this.store.updatePartitionCheck(partitionRootId, now);
            return {
                partitionRootId,
                subtreeHash: partitionRoot.subtree_hash,
                changed: false,
                fetchedAt: partitionRoot.fetched_at ?? now,
            };
        }

        const result = await this.store.replacePartition(
            subtree,
            now,
            partitionRoot.subtree_hash,
        );
        this.events.emitPartitionUpdated({
            partition_root_id: result.partitionRootId,
            new_subtree_hash: result.subtreeHash,
            fetched_at: result.fetchedAt,
        });

        return result;
    }
}
