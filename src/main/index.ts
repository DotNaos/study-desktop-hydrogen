import { createLogger } from '@aryazos/ts-base/logging';
import {
    app,
    BrowserWindow,
    dialog,
    ipcMain,
    nativeImage,
    ShareMenu,
    shell,
} from 'electron';
import { spawn } from 'node:child_process';
import { existsSync, promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { migrateCredentials, PORT, store } from './config';
import { exportNodeSaveAs, exportNodeToShareZip } from './exportDesktop';
import './logger';
import { startServer, stopServer } from './server';
import { bootstrapMoodleAuth, registerSessionPersistence } from './startupAuth';

const logger = createLogger('com.aryazos.study-sync.main');
const APP_ICON_RELATIVE_PATH = path.join('resources', 'icon.png');
const APP_ICON_MAC_RELATIVE_PATH = path.join('resources', 'icon-mac.png');
const GOODNOTES_APP_CANDIDATES = [
    'Goodnotes.app',
    'Goodnotes 6.app',
    'GoodNotes.app',
    'GoodNotes 6.app',
];

if (process.versions?.electron) {
    process.env.STUDY_SYNC_DISABLE_AUTH =
        process.env.STUDY_SYNC_DISABLE_AUTH ?? '1';
}

let mainWindow: BrowserWindow | null = null;

function getRuntimeIconCandidatePaths(iconRelativePath: string): string[] {
    return [
        path.resolve(__dirname, '../../', iconRelativePath),
        path.resolve(app.getAppPath(), iconRelativePath),
        path.resolve(process.cwd(), iconRelativePath),
        path.resolve(process.resourcesPath, iconRelativePath),
    ];
}

function applyRuntimeAppIcon(): string | undefined {
    const iconRelativePaths =
        process.platform === 'darwin'
            ? [APP_ICON_MAC_RELATIVE_PATH, APP_ICON_RELATIVE_PATH]
            : [APP_ICON_RELATIVE_PATH];
    const candidatePaths = [
        ...new Set(
            iconRelativePaths.flatMap((iconRelativePath) =>
                getRuntimeIconCandidatePaths(iconRelativePath),
            ),
        ),
    ];
    const iconPath = candidatePaths.find((candidatePath) =>
        existsSync(candidatePath),
    );

    if (!iconPath) {
        logger.warn('Runtime app icon not found', { candidatePaths });
        return undefined;
    }

    if (process.platform === 'darwin') {
        const dockIcon = nativeImage.createFromPath(iconPath);
        if (!dockIcon.isEmpty()) {
            app.dock?.setIcon(dockIcon);
        } else {
            logger.warn('Failed to load runtime app icon for dock', {
                iconPath,
            });
        }
    }

    return iconPath;
}

function resolveGoodnotesAppPath(): string | null {
    if (process.platform !== 'darwin') {
        return null;
    }

    const appRoots = ['/Applications', path.join(app.getPath('home'), 'Applications')];
    for (const root of appRoots) {
        for (const appName of GOODNOTES_APP_CANDIDATES) {
            const appPath = path.join(root, appName);
            if (existsSync(appPath)) {
                return appPath;
            }
        }
    }

    return null;
}

async function exportNodeToTemporaryPath(
    nodeId: string,
): Promise<{ fileCount: number; outputPath: string }> {
    const tempRoot = await fs.mkdtemp(path.join(tmpdir(), 'study-desktop-open-'));
    return exportNodeSaveAs(nodeId, tempRoot);
}

async function openPathWithApp(appPath: string, targetPath: string): Promise<void> {
    if (process.platform !== 'darwin') {
        const openError = await shell.openPath(targetPath);
        if (openError) {
            throw new Error(openError);
        }
        return;
    }

    await new Promise<void>((resolve, reject) => {
        const child = spawn('open', ['-a', appPath, targetPath], { stdio: 'ignore' });
        child.once('error', reject);
        child.once('exit', (code) => {
            if (code === 0) {
                resolve();
                return;
            }
            reject(new Error(`OPEN_APP_FAILED:${String(code)}`));
        });
    });
}

function createMainWindow(iconPath?: string): BrowserWindow {
    const window = new BrowserWindow({
        width: 1440,
        height: 920,
        minWidth: 1024,
        minHeight: 700,
        autoHideMenuBar: true,
        title: 'Study Desktop',
        ...(iconPath ? { icon: iconPath } : {}),
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
    const runtimeIconPath = applyRuntimeAppIcon();

    migrateCredentials();
    registerSessionPersistence();

    startServer(PORT);
    void bootstrapMoodleAuth();

    mainWindow = createMainWindow(runtimeIconPath);

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            mainWindow = createMainWindow(runtimeIconPath);
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

ipcMain.handle('study-sync:isGoodnotesAvailable', () => {
    return resolveGoodnotesAppPath() !== null;
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

ipcMain.handle('study-sync:exportOpenWith', async (_event, nodeId: string) => {
    if (typeof nodeId !== 'string' || !nodeId.trim()) {
        return {
            ok: false,
            error: 'NODE_ID_REQUIRED',
        };
    }

    if (process.platform !== 'darwin') {
        return {
            ok: false,
            error: 'OPEN_WITH_NOT_SUPPORTED',
        };
    }

    try {
        const appPicker = await dialog.showOpenDialog(mainWindow ?? undefined, {
            title: 'App auswählen',
            defaultPath: '/Applications',
            properties: ['openFile'],
            filters: [{ name: 'Applications', extensions: ['app'] }],
            buttonLabel: 'Öffnen',
        });

        if (appPicker.canceled || appPicker.filePaths.length === 0) {
            return { ok: false, cancelled: true };
        }

        const appPath = appPicker.filePaths[0];
        const exportResult = await exportNodeToTemporaryPath(nodeId);
        await openPathWithApp(appPath, exportResult.outputPath);

        return {
            ok: true,
            cancelled: false,
            appPath,
            ...exportResult,
        };
    } catch (error) {
        logger.error('Open-with export failed', {
            nodeId,
            error: error instanceof Error ? error.message : String(error),
        });
        return {
            ok: false,
            error: 'EXPORT_OPEN_WITH_FAILED',
        };
    }
});

ipcMain.handle(
    'study-sync:exportOpenGoodnotes',
    async (_event, nodeId: string) => {
        if (typeof nodeId !== 'string' || !nodeId.trim()) {
            return {
                ok: false,
                error: 'NODE_ID_REQUIRED',
            };
        }

        if (process.platform !== 'darwin') {
            return {
                ok: false,
                error: 'GOODNOTES_NOT_SUPPORTED',
            };
        }

        const goodnotesPath = resolveGoodnotesAppPath();
        if (!goodnotesPath) {
            return {
                ok: false,
                error: 'GOODNOTES_NOT_INSTALLED',
            };
        }

        try {
            const exportResult = await exportNodeToTemporaryPath(nodeId);
            await openPathWithApp(goodnotesPath, exportResult.outputPath);

            return {
                ok: true,
                appPath: goodnotesPath,
                ...exportResult,
            };
        } catch (error) {
            logger.error('Goodnotes export failed', {
                nodeId,
                error: error instanceof Error ? error.message : String(error),
            });
            return {
                ok: false,
                error: 'EXPORT_GOODNOTES_FAILED',
            };
        }
    },
);
