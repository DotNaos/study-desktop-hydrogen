export type ExportMappingStatus = "linked" | "missing" | "ambiguous" | "unmapped";

export interface ExportMappingRecord {
  remoteId: string;
  providerId?: string;
  relativePath?: string;
  size?: number;
  mtimeMs?: number;
  inode?: number;
  deviceId?: number;
  updatedAt: number;
  lastSyncedAt?: number;
}

export interface ExportStoreData {
  version: 2 | 3 | 4 | 5 | 6;
  updatedAt: number;
  mappings: ExportMappingRecord[];
}

export interface ExportFileEntry {
  relativePath: string;
  name: string;
  size: number;
  mtimeMs: number;
  inode: number;
  deviceId: number;
}

export interface ExportFileIndex {
  files: ExportFileEntry[];
  folders: string[];
  byName: Map<string, ExportFileEntry[]>;
  byRelativePath: Map<string, ExportFileEntry>;
}

export interface ExportMappingStatusInfo {
  record: ExportMappingRecord;
  status: ExportMappingStatus;
  resolvedPath?: string;
  candidatePaths?: string[];
  suggestedPath?: string;
}

// ============================================================================
// Ignore Rules
// ============================================================================

export interface IgnoreRule {
  pattern: string;
  createdAt: number;
}

// ============================================================================
// Predictions
// ============================================================================

export type PredictionConfidence = "high" | "medium" | "low";

export interface PredictionResult {
  remoteId: string;
  remoteName: string;
  remotePath: string;
  confidence: PredictionConfidence;
  reason: string;
  fileExtension?: string;
  type: "folder" | "file";
}
