export type UpdaterStage =
    | 'idle'
    | 'checking'
    | 'available'
    | 'not-available'
    | 'downloading'
    | 'downloaded'
    | 'error'
    | 'unsupported';

export interface UpdaterState {
    enabled: boolean;
    stage: UpdaterStage;
    currentVersion: string;
    latestVersion: string | null;
    progressPercent: number | null;
    bytesPerSecond: number | null;
    transferredBytes: number | null;
    totalBytes: number | null;
    message: string | null;
    error: string | null;
    checkedAt: number | null;
}

export interface UpdaterActionResult {
    ok: boolean;
    error?: string;
}
