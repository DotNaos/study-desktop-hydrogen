/**
 * Node and Provider type definitions for the Sync app.
 *
 * Design Principles:
 * - Nodes have frontmatter (metadata) + optional data (file content)
 * - "refreshable" nodes are folders whose children can be dynamically loaded
 * - Sync handles auth internally, returns error codes to Desktop
 * - Lazy loading: children fetched on first request, cached until manual refresh
 */

import { NodeItemBase } from '@aryazos/study/types';

/**
 * Extended node type for provider nodes.
 * Extends the base NodeItemBase type with provider-specific fields.
 */
export interface ProviderNode extends NodeItemBase {
  /** ID of the provider this node comes from (e.g., "moodle") */
  providerId: string;

  /**
   * If true, this node's children can be dynamically loaded/refreshed.
   * Used for: Courses, Sections (folders whose content comes from external sources)
   */
  refreshable?: boolean;

  /** Whether this node has been materialized (downloaded/cached) */
  materialized?: boolean;

  /** Whether the node content is read-only */
  readOnly?: boolean;

  /** Whether the node is locked (cannot be edited) */
  locked?: boolean;

  /** URL to the original source (for linking back) */
  sourceUrl?: string;

  /**
   * For file nodes: URL to download the file content.
   * Internal use only - not exposed to Desktop.
   */
  downloadUrl?: string;

  /**
   * MIME type for file nodes (e.g., "application/pdf")
   */
  mimeType?: string;

  /**
   * Name of the group this node belongs to (e.g. "HS24").
   * Legacy property, might be deprecated in favor of isGroup structure.
   */
  group?: string;

  /**
   * If true, this folder is a grouping container (e.g., term/semester or section).
   * Can be toggled on/off in the UI.
   */
  isGroup?: boolean;
}



/**
 * Interface for external data providers (e.g., Moodle, Google Drive).
 *
 * Providers are responsible for:
 * - Fetching node metadata from external sources
 * - Downloading file content
 * - Handling their own authentication
 *
 * Sync app handles:
 * - Caching
 * - API exposure
 * - Credential storage
 */
export interface DataProvider {
  /** Unique identifier for this provider (e.g., "moodle") */
  id: string;

  /** Human-readable name */
  name: string;

  /**
   * Optional initialization hook.
   * Called by the Sync app when provider is first loaded.
   */
  initialize?(): Promise<void>;

  /**
   * Optional cleanup hook.
   * Called by the Sync app when provider is unloaded.
   */
  dispose?(): Promise<void>;

  /**
   * Check if the provider is authenticated and ready.
   * @returns true if authenticated, false otherwise
   */
  isAuthenticated(): boolean;

  /**
   * List nodes at the given level.
   * @param parentId - Parent node ID, or undefined for root level
   * @returns Array of nodes at that level
   * @throws Error with code 'AUTH_REQUIRED' if not authenticated
   */
  listNodes(parentId?: string): Promise<ProviderNode[]>;

  /**
   * Get a single node by ID.
   * @param id - Node ID
   * @returns The node, or null if not found
   */
  getNode(id: string): Promise<ProviderNode | null>;

  /**
   * Download file content for a file node.
   * @param nodeId - ID of the file node
   * @returns Buffer containing the file data
   * @throws Error if node is not a file or download fails
   */
  downloadFile(nodeId: string): Promise<Buffer>;

  /**
   * Materialize a node (prepare it for local use).
   * For files: downloads content
   * For folders: fetches children
   * @param id - Node ID to materialize
   * @returns The materialized node with updated metadata, or null if unsupported
   */
  materializeNode(id: string): Promise<ProviderNode | null>;
}

/**
 * Error codes returned by providers and API.
 */
export const ProviderErrorCodes = {
  /** Authentication required - credentials missing or invalid */
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  /** Node not found */
  NOT_FOUND: 'NOT_FOUND',
  /** Provider not available */
  PROVIDER_UNAVAILABLE: 'PROVIDER_UNAVAILABLE',
  /** Download failed */
  DOWNLOAD_FAILED: 'DOWNLOAD_FAILED',
} as const;

export type ProviderErrorCode = typeof ProviderErrorCodes[keyof typeof ProviderErrorCodes];

/**
 * Custom error class for provider errors.
 */
export class ProviderError extends Error {
  constructor(
    public code: ProviderErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}
