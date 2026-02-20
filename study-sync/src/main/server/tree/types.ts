import type { ProviderNode } from "../../types";

export type NodeKind = "folder" | "file" | "page" | "link" | "unknown";

export interface TreeNodeInput {
  remoteKey: string;
  name: string;
  kind: NodeKind;
  payload?: Record<string, unknown> | null;
  children?: TreeNodeInput[];
  ttlSeconds?: number;
  isGroup?: boolean;
}


export interface TreeNodeRecord {
  id: string;
  remote_key: string;
  parent_id: string | null;
  name: string;
  name_norm: string;
  kind: NodeKind;
  has_children: number;
  payload_json: string | null;
  checked_at: number | null;
  fetched_at: number | null;
  ttl_s: number;
  self_hash: string;
  subtree_hash: string;
  partition_root_id: string;
  progress?: number | null;
}

export interface PartitionUpdateResult {
  partitionRootId: string;
  subtreeHash: string;
  changed: boolean;
  fetchedAt: number;
}

export interface CalendarMatchRecord {
  calendar_name_norm: string;
  calendar_name_raw: string;
  node_id: string;
  updated_at: number;
}

export type TreeNodeView = ProviderNode & {
  hasChildren: boolean;
};
