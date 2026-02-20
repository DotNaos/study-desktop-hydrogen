import { canonicalizePayload, hashString } from "./hashing";
import { normalizeName } from "./normalize";
import type { TreeNodeInput, TreeNodeRecord } from "./types";

const DEFAULT_TTL_SECONDS = 3600;

function coerceKind(kind: string): "folder" | "file" | "page" | "link" | "unknown" {
  if (kind === "folder" || kind === "file" || kind === "page" || kind === "link") {
    return kind;
  }
  return "unknown";
}

function serializeSelfHashInput(remoteKey: string, nameNorm: string, kind: string, payloadJson: string): string {
  return [remoteKey, nameNorm, kind, payloadJson].join("|");
}

export interface BuildResult {
  records: TreeNodeRecord[];
  partitionRootId: string;
  subtreeHash: string;
}

export function buildPartitionRecords(root: TreeNodeInput, fetchedAt: number): BuildResult {
  const records: TreeNodeRecord[] = [];
  const partitionRootId = root.remoteKey;
  const ttlSeconds = root.ttlSeconds ?? DEFAULT_TTL_SECONDS;

  function walk(node: TreeNodeInput, parentId: string | null): { subtreeHash: string } {
    const nameNorm = normalizeName(node.name);
    const payloadJson = canonicalizePayload(node.payload);
    const selfHash = hashString(serializeSelfHashInput(node.remoteKey, nameNorm, node.kind, payloadJson));
    const children = node.children ?? [];
    const childHashes = children.map((child) => {
      const childResult = walk(child, node.remoteKey);
      return { remoteKey: child.remoteKey, subtreeHash: childResult.subtreeHash };
    });

    childHashes.sort((a, b) => a.remoteKey.localeCompare(b.remoteKey));

    const subtreeHash = hashString([
      selfHash,
      childHashes.map((child) => `${child.remoteKey}:${child.subtreeHash}`).join("|")
    ].join("|"));

    records.push({
      id: node.remoteKey,
      remote_key: node.remoteKey,
      parent_id: parentId,
      name: node.name,
      name_norm: nameNorm,
      kind: coerceKind(node.kind),
      has_children: children.length > 0 ? 1 : 0,
      payload_json: payloadJson.length > 0 ? payloadJson : null,
      checked_at: fetchedAt,
      fetched_at: fetchedAt,
      ttl_s: ttlSeconds,
      self_hash: selfHash,
      subtree_hash: subtreeHash,
      partition_root_id: partitionRootId,
    });

    return { subtreeHash };
  }

  const rootResult = walk(root, null);
  return { records, partitionRootId, subtreeHash: rootResult.subtreeHash };
}
