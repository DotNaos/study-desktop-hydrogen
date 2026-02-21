import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('studySync', {
    getApiBase: () => ipcRenderer.invoke('study-sync:getApiBase') as Promise<string>,
    openExternal: (url: string) => ipcRenderer.invoke('study-sync:openExternal', url),
    getTheme: () => ipcRenderer.invoke('study-sync:getTheme') as Promise<{ mode: 'light' | 'dark' }>,
    isGoodnotesAvailable: () =>
        ipcRenderer.invoke('study-sync:isGoodnotesAvailable') as Promise<boolean>,
    exportSaveAs: (nodeId: string) =>
        ipcRenderer.invoke('study-sync:exportSaveAs', nodeId) as Promise<{
            ok: boolean;
            cancelled?: boolean;
            outputPath?: string;
            fileCount?: number;
            error?: string;
        }>,
    exportShare: (nodeId: string) =>
        ipcRenderer.invoke('study-sync:exportShare', nodeId) as Promise<{
            ok: boolean;
            zipPath?: string;
            fileCount?: number;
            error?: string;
        }>,
    exportOpenWith: (nodeId: string) =>
        ipcRenderer.invoke('study-sync:exportOpenWith', nodeId) as Promise<{
            ok: boolean;
            cancelled?: boolean;
            outputPath?: string;
            appPath?: string;
            fileCount?: number;
            error?: string;
        }>,
    exportOpenGoodnotes: (nodeId: string) =>
        ipcRenderer.invoke('study-sync:exportOpenGoodnotes', nodeId) as Promise<{
            ok: boolean;
            outputPath?: string;
            appPath?: string;
            fileCount?: number;
            error?: string;
        }>,
});
