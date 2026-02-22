/// <reference types="vite/client" />
import type { UpdaterActionResult, UpdaterState } from '../shared/updater';

declare global {
  interface Window {
    studySync?: {
      getApiBase?: () => Promise<string>;
      getTheme?: () => Promise<{ mode: 'light' | 'dark' }>;
      openExternal?: (url: string) => Promise<boolean>;
      isGoodnotesAvailable?: () => Promise<boolean>;
      exportSaveAs?: (nodeId: string) => Promise<{
        ok: boolean;
        cancelled?: boolean;
        outputPath?: string;
        fileCount?: number;
        error?: string;
      }>;
      exportShare?: (nodeId: string) => Promise<{
        ok: boolean;
        zipPath?: string;
        fileCount?: number;
        error?: string;
      }>;
      exportOpenWith?: (nodeId: string) => Promise<{
        ok: boolean;
        cancelled?: boolean;
        outputPath?: string;
        appPath?: string;
        fileCount?: number;
        error?: string;
      }>;
      exportOpenGoodnotes?: (nodeId: string) => Promise<{
        ok: boolean;
        outputPath?: string;
        appPath?: string;
        fileCount?: number;
        error?: string;
      }>;
      updaterGetState?: () => Promise<UpdaterState>;
      updaterCheckForUpdates?: () => Promise<UpdaterActionResult>;
      updaterDownloadUpdate?: () => Promise<UpdaterActionResult>;
      updaterQuitAndInstall?: () => Promise<UpdaterActionResult>;
      onUpdaterStateChange?: (
        callback: (state: UpdaterState) => void
      ) => () => void;
    };
  }
}

export {};
