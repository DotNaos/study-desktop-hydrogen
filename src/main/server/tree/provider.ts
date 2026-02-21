import type { TreeNodeInput } from "./types";

export interface TreeProvider {
  id: string;
  isAuthenticated(): boolean;
  listPartitionRoots(): Promise<TreeNodeInput[]>;
  fetchSubtree(partitionRemoteKey: string): Promise<TreeNodeInput>;
}
