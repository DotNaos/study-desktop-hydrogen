import { contextBridge, ipcRenderer } from 'electron';
import type { UpdaterActionResult, UpdaterState } from '../shared/updater';

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
    updaterGetState: () =>
        ipcRenderer.invoke('study-sync:updater:getState') as Promise<UpdaterState>,
    updaterCheckForUpdates: () =>
        ipcRenderer.invoke(
            'study-sync:updater:checkForUpdates',
        ) as Promise<UpdaterActionResult>,
    updaterDownloadUpdate: () =>
        ipcRenderer.invoke(
            'study-sync:updater:downloadUpdate',
        ) as Promise<UpdaterActionResult>,
    updaterQuitAndInstall: () =>
        ipcRenderer.invoke(
            'study-sync:updater:quitAndInstall',
        ) as Promise<UpdaterActionResult>,
    onUpdaterStateChange: (callback: (state: UpdaterState) => void) => {
        const listener = (_event: Electron.IpcRendererEvent, state: UpdaterState) => {
            callback(state);
        };
        ipcRenderer.on('study-sync:updater:state', listener);
        return () => {
            ipcRenderer.removeListener('study-sync:updater:state', listener);
        };
    },
});
