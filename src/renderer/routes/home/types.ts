export interface AuthStatusResponse {
    authenticated: boolean;
    error?: string | null;
    selectedSchool?: string | null;
    hasStoredCredentials?: boolean;
}

export interface LoginResponse {
    ok?: boolean;
    authenticated?: boolean;
    error?: string;
}

export type ExportMode = 'saveAs' | 'share';
export type PanelMode = 'explorer-only' | 'split' | 'viewer-only';
export type ViewMode = 'list' | 'grid';

export const DEFAULT_SPLIT_RATIO = 0.58;
export const MIN_SPLIT_RATIO = 0.25;
export const MAX_SPLIT_RATIO = 0.75;
export const COLLAPSE_TO_VIEWER_THRESHOLD = 0.18;
export const COLLAPSE_TO_EXPLORER_THRESHOLD = 0.82;
