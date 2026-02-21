import { createLogger } from '@aryazos/ts-base/logging';
import { app, BrowserWindow, dialog, ipcMain, ShareMenu, shell } from 'electron';
import path from 'node:path';
import { migrateCredentials, PORT, store } from './config';
import { exportNodeSaveAs, exportNodeToShareZip } from './exportDesktop';
import './logger';
import { startServer, stopServer } from './server';
import { bootstrapMoodleAuth, registerSessionPersistence } from './startupAuth';

const logger = createLogger('com.aryazos.study-sync.main');

if (process.versions?.electron) {
    process.env.STUDY_SYNC_DISABLE_AUTH =
        process.env.STUDY_SYNC_DISABLE_AUTH ?? '1';
}

let mainWindow: BrowserWindow | null = null;

function createMainWindow(): BrowserWindow {
    const window = new BrowserWindow({
        width: 1440,
        height: 920,
        minWidth: 1024,
        minHeight: 700,
        autoHideMenuBar: true,
        title: 'Study Desktop',
        webPreferences: {
            preload: path.join(__dirname, '../preload/index.js'),
            sandbox: false,
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    window.webContents.setWindowOpenHandler(({ url }) => {
        void shell.openExternal(url);
        return { action: 'deny' };
    });

    if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
        void window.loadURL(process.env.ELECTRON_RENDERER_URL);
    } else {
        void window.loadFile(path.join(__dirname, '../renderer/index.html'));
    }

    return window;
}

app.whenReady().then(async () => {
    app.setName('Study Desktop');

    migrateCredentials();
    registerSessionPersistence();

    startServer(PORT);
    void bootstrapMoodleAuth();

    mainWindow = createMainWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            mainWindow = createMainWindow();
        }
    });
});

app.on('before-quit', () => {
    stopServer();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

ipcMain.handle('study-sync:getApiBase', () => {
    return `http://127.0.0.1:${PORT}/api`;
});

ipcMain.handle('study-sync:openExternal', async (_event, url: string) => {
    if (typeof url !== 'string' || !url.trim()) {
        return false;
    }

    try {
        await shell.openExternal(url);
        return true;
    } catch (error) {
        logger.error('Failed to open external URL', {
            url,
            error: error instanceof Error ? error.message : String(error),
        });
        return false;
    }
});

ipcMain.handle('study-sync:getTheme', () => {
    return { mode: store.get('preferences.darkMode') ? 'dark' : 'light' };
});

ipcMain.handle('study-sync:exportSaveAs', async (_event, nodeId: string) => {
    if (typeof nodeId !== 'string' || !nodeId.trim()) {
        return {
            ok: false,
            error: 'NODE_ID_REQUIRED',
        };
    }

    try {
        const result = await dialog.showOpenDialog(mainWindow ?? undefined, {
            title: 'Export destination wählen',
            properties: ['openDirectory', 'createDirectory'],
            buttonLabel: 'Exportieren',
        });

        if (result.canceled || result.filePaths.length === 0) {
            return { ok: false, cancelled: true };
        }

        const destinationDir = result.filePaths[0];
        const exportResult = await exportNodeSaveAs(nodeId, destinationDir);
        return {
            ok: true,
            cancelled: false,
            ...exportResult,
        };
    } catch (error) {
        logger.error('Save-as export failed', {
            nodeId,
            error: error instanceof Error ? error.message : String(error),
        });
        return {
            ok: false,
            error: 'EXPORT_SAVE_AS_FAILED',
        };
    }
});

ipcMain.handle('study-sync:exportShare', async (_event, nodeId: string) => {
    if (typeof nodeId !== 'string' || !nodeId.trim()) {
        return {
            ok: false,
            error: 'NODE_ID_REQUIRED',
        };
    }

    if (process.platform !== 'darwin') {
        return {
            ok: false,
            error: 'SHARE_NOT_SUPPORTED',
        };
    }

    try {
        const shareResult = await exportNodeToShareZip(nodeId);
        const shareMenu = new ShareMenu({
            filePaths: [shareResult.zipPath],
        });

        shareMenu.popup({
            window: mainWindow ?? undefined,
        });

        return {
            ok: true,
            ...shareResult,
        };
    } catch (error) {
        logger.error('Share export failed', {
            nodeId,
            error: error instanceof Error ? error.message : String(error),
        });
        return {
            ok: false,
            error: 'EXPORT_SHARE_FAILED',
        };
    }
});
