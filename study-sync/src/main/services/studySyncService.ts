import type {
    SyncAuthStatus,
    SyncNode,
    SyncSetSessionRequest,
    SyncSetSessionResponse,
} from '@aryazos/study/types';
import { clearMoodleAuth, setMoodleCookies, validateMoodleSession } from "../moodle";
import { primaryProvider } from "../providers";
import { remoteCache, type CachedRemoteNode } from "../remoteCache";
import { ProviderErrorCodes } from "../types";

export type StudySyncServiceErrorCode =
  | typeof ProviderErrorCodes[keyof typeof ProviderErrorCodes]
  | "COOKIES_REQUIRED"
  | "SESSION_FAILED";

export class StudySyncServiceError extends Error {
  code: StudySyncServiceErrorCode;

  constructor(code: StudySyncServiceErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

function requireAuth(): void {
  if (!primaryProvider.isAuthenticated()) {
    throw new StudySyncServiceError(
      ProviderErrorCodes.AUTH_REQUIRED,
      "Not authenticated",
    );
  }
}

function normalizeCachedNode(node: CachedRemoteNode): SyncNode {
  return {
    id: node.id,
    name: node.name,
    parent: node.parent ?? "root",
    type: node.type,
    fileExtension: node.fileExtension,
    providerId: node.providerId,
    group: node.groupName,
    sourceUrl: node.sourceUrl,
  };
}

export function getAuthStatus(): SyncAuthStatus {
  const authenticated = primaryProvider.isAuthenticated();
  return {
    authenticated,
    error: authenticated ? null : ProviderErrorCodes.AUTH_REQUIRED,
  };
}

export async function setSession(
  payload: SyncSetSessionRequest,
): Promise<SyncSetSessionResponse> {
  const cookies = String(payload.cookies ?? "");
  if (!cookies.trim()) {
    throw new StudySyncServiceError(
      "COOKIES_REQUIRED",
      "Session cookies are required",
    );
  }

  try {
    await setMoodleCookies(cookies, payload.schoolId, {
      skipFetch: payload.skipFetch,
    });
    const isValid = await validateMoodleSession();
    if (!isValid) {
      clearMoodleAuth();
      throw new StudySyncServiceError(
        ProviderErrorCodes.AUTH_REQUIRED,
        "Session expired. Please re-authenticate.",
      );
    }
  } catch (error) {
    if (error instanceof StudySyncServiceError) {
      throw error;
    }
    throw new StudySyncServiceError("SESSION_FAILED", "Failed to apply session");
  }

  return { ok: true, authenticated: primaryProvider.isAuthenticated() };
}

// But wait, listChildren calls primaryProvider.listNodes(parentId).
// If parentId is Term, it returns Courses.
// If valid isGroup is available, use it.

export async function listRootNodes(includeGroups: boolean = true): Promise<SyncNode[]> {
  requireAuth();
  const nodes = await primaryProvider.listNodes();
  if (includeGroups) {
      return nodes;
  }

  // Flatten root nodes (Terms)
  const flattened: SyncNode[] = [];
  for (const node of nodes) {
      if ((node as any).isGroup) {
          // It's a term. Fetch courses.
          const children = await primaryProvider.listNodes(node.id);
          flattened.push(...children);
      } else {
          flattened.push(node);
      }
  }
  return flattened;
}

export async function listChildren(parentId: string, includeGroups: boolean = true): Promise<SyncNode[]> {
  requireAuth();

  let children: SyncNode[] = [];
  if (await remoteCache.hasChildren(parentId)) {
    const cached = await remoteCache.getChildren(parentId);
    children = cached.map(normalizeCachedNode);
  } else {
    children = await primaryProvider.listNodes(parentId);
    await remoteCache.setChildren(parentId, children);
  }

  if (includeGroups) {
      return children;
  }

  // Flatten logic
  const flattened: SyncNode[] = [];
  for (const node of children) {
       if ((node as any).isGroup) {
           // Section group -> hoist resources
           const grandChildren = await listChildren(node.id, false);
           flattened.push(...grandChildren);
       } else {
           flattened.push(node);
       }
  }
  return flattened;
}


export async function materializeNode(
  nodeId: string,
): Promise<SyncNode | null> {
  requireAuth();
  const node = await primaryProvider.materializeNode(nodeId);
  if (node) {
    await remoteCache.cacheNode(node);
  }
  return node;
}

export function getCachedFile(
  nodeId: string,
  extension?: string,
): Buffer | null {
  if (extension) {
    const data = remoteCache.getFile(nodeId, extension);
    if (data) return data;
  }
  return remoteCache.getFile(nodeId, "pdf");
}
