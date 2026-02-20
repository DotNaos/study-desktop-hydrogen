export type WizardPhase = "idle" | "resolving-local" | "resolving-remote" | "complete";

export type LocalStackItem = {
  path: string;
  name: string;
  isFolder: boolean;
  resolved: boolean;
  remoteId?: string;
  remoteName?: string;
};

export type LocalTreeNode = {
  path: string;
  name: string;
  isFolder: boolean;
  resolved: boolean;
  ignored: boolean;
  children: LocalTreeNode[];
};

export type SearchModalState = {
  open: boolean;
  localPath: string;
  localName: string;
};

export type PredictionResult = {
  remoteId: string;
  remoteName: string;
  remotePath: string;
  confidence: "high" | "medium" | "low";
  reason: string;
  fileExtension?: string;
  type: "folder" | "file";
};

export type IgnoreRule = {
  pattern: string;
  createdAt: number;
};

import type { NodeItemBase } from '@aryazos/study/types';

// Remote node extending the shared NodeItemBase, with optional parent for root nodes
export type RemoteNode = Omit<NodeItemBase, "parent"> & {
  parent?: string;
  children?: RemoteNode[];
};

export type EnrichedRemoteNode = RemoteNode & {
  status: "mapped" | "unmapped" | "ignored";
  localPath?: string; // If mapped
  remotePath?: string; // Full path from root including ancestor names
};
