import { createLogger } from '@aryazos/ts-base/logging';
import { BrowserWindow, dialog, shell } from 'electron';
import { join } from 'path';
import { icon as appIcon, hasIcon } from './appIcon';
import { store } from './config';
import { registerDockWindow } from './dock';
import { getExportRoot, setExportRoot } from './downloader';

const logger = createLogger('com.aryazos.study-sync.downloader.window');

let exportWindow: BrowserWindow | null = null;
const hasAppIcon = hasIcon;

async function selectExportRoot(): Promise<string | null> {
    const result = await dialog.showOpenDialog({
        title: 'Choose export folder',
        properties: ['openDirectory', 'createDirectory'],
    });

    if (result.canceled || result.filePaths.length === 0) {
        return null;
    }

    const selected = result.filePaths[0];
    await setExportRoot(selected);

    // Persist to store so it survives app restarts
    store.set('exportRoot', selected);

    return selected;
}

export function openDownloaderWindow(port: number): void {
    if (exportWindow) {
        exportWindow.focus();
        return;
    }

    exportWindow = new BrowserWindow({
        width: 1280,
        height: 860,
        title: 'Downloader',
        resizable: true,
        minimizable: true,
        maximizable: true,
        titleBarStyle: 'default',
        ...(hasAppIcon ? { icon: appIcon } : {}),
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            preload: join(__dirname, '../preload/index.js'),
        },
    });
    registerDockWindow(exportWindow);

    exportWindow.on('closed', () => {
        exportWindow = null;
    });

    exportWindow.webContents.on('will-navigate', async (event, url) => {
        if (!url.startsWith('study-sync://')) return;
        event.preventDefault();

        if (url === 'study-sync://select-export-root') {
            try {
                const selected = await selectExportRoot();
                if (selected && exportWindow) {
                    exportWindow.reload();
                }
            } catch (error) {
                logger.error('Failed to select export root', { error });
            }
        }

        if (url === 'study-sync://reveal-export-root') {
            const rootPath = getExportRoot();
            if (rootPath) {
                shell.openPath(rootPath);
            }
        }
    });

    const devUrl = process.env['ELECTRON_RENDERER_URL'];
    if (devUrl) {
        exportWindow.loadURL(`${devUrl}?port=${port}`);
    } else {
        exportWindow.loadFile(join(__dirname, '../renderer/index.html'), {
            query: { port: String(port) },
        });
    }
}
