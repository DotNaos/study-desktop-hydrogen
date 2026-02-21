/// <reference types="vite/client" />

declare global {
  interface Window {
    studySync?: {
      getApiBase?: () => Promise<string>;
      getTheme?: () => Promise<{ mode: 'light' | 'dark' }>;
      openExternal?: (url: string) => Promise<boolean>;
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
    };
  }
}

export {};
