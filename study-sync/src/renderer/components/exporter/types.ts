export type RemoteNode = {
  id: string;
  name: string;
  type: "folder" | "file" | "composite";
  parent: string | null;
  providerId?: string;
  fileExtension?: string;
  group?: string;
};

export type ExportFileEntry = {
  relativePath: string;
  name: string;
  size: number;
  mtimeMs: number;
};

export type ExportMappingRecord = {
  remoteId: string;
  providerId?: string;
  relativePath?: string;
  updatedAt: number;
  lastSyncedAt?: number;
  size?: number;
  mtimeMs?: number;
};

export type ExportMappingStatus = "linked" | "missing" | "ambiguous" | "unmapped";

export type ExportMappingStatusInfo = {
  record: ExportMappingRecord;
  status: ExportMappingStatus;
  resolvedPath?: string;
  candidatePaths?: string[];
  suggestedPath?: string;
};

export type ExportScan = {
  rootPath?: string;
  files: ExportFileEntry[];
  folders: string[];
  mappings: ExportMappingStatusInfo[];
};
