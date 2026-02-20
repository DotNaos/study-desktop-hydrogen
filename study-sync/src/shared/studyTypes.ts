export interface NodeItemBase {
    id: string;
    name: string;
    parent?: string;
    type: 'folder' | 'file' | 'page' | 'link' | 'composite' | 'unknown';
    fileExtension?: string;
    providerId?: string;
    group?: string;
    sourceUrl?: string;
    progress?: number;
    isCompleted?: boolean;
}

export type Note = NodeItemBase;
export type SyncNode = NodeItemBase;

export interface SyncAuthStatus {
    authenticated: boolean;
    error: string | null;
}

export interface SyncSetSessionRequest {
    cookies: string;
    schoolId?: string;
    skipFetch?: boolean;
}

export interface SyncSetSessionResponse {
    ok: boolean;
    authenticated: boolean;
}
