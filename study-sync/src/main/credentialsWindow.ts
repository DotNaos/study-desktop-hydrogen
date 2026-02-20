import { createLogger } from '@aryazos/ts-base/logging';
import { BrowserWindow } from 'electron';
import { join } from 'path';
import { icon as appIcon, hasIcon } from './appIcon';
import { closeAuthWindow, performAutoLogin } from './authentication';
import { getSchoolCredentials, getSelectedSchoolConfig, store } from './config';
import { registerDockWindow } from './dock';
import { updateTrayMenu } from './tray';

const logger = createLogger('com.aryazos.study-sync.credentials');

export async function openCredentialsDialog(): Promise<void> {
    const school = getSelectedSchoolConfig();
    const creds = getSchoolCredentials();

    const credWindow = new BrowserWindow({
        width: 320,
        height: 250,
        useContentSize: true,
        title: `${school.name} Login`,
        resizable: false,
        minimizable: false,
        maximizable: false,
        alwaysOnTop: true,
        titleBarStyle: 'hiddenInset',
        vibrancy: 'under-window',
        ...(hasIcon ? { icon: appIcon } : {}),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        },
    });
    registerDockWindow(credWindow);

    const query = new URLSearchParams();
    query.set('view', 'login');
    if (creds.username) query.set('username', creds.username);
    if (creds.password) query.set('password', 'set'); // Value doesn't matter, just presence

    const devUrl = process.env['ELECTRON_RENDERER_URL'];
    if (devUrl) {
        credWindow.loadURL(`${devUrl}?${query.toString()}`);
    } else {
        credWindow.loadFile(join(__dirname, '../renderer/index.html'), {
            search: query.toString(),
        });
    }

    credWindow.webContents.on('will-navigate', (event, url) => {
        if (url.startsWith('save-creds://')) {
            event.preventDefault();
            const parts = url.replace('save-creds://', '').split('/');
            const username = decodeURIComponent(parts[0]);
            const password = decodeURIComponent(parts[1] || '');

            if (username && password) {
                const s = getSelectedSchoolConfig();
                store.set(`schools.${s.id}.username`, username);
                store.set(`schools.${s.id}.password`, password);
                logger.info('Credentials saved', {
                    schoolId: s.id,
                    schoolName: s.name,
                    username,
                });
                updateTrayMenu();

                // Close the credentials dialog first
                credWindow.close();

                // Close any existing auth window (with the banner) and restart auto-login
                closeAuthWindow();

                // Small delay to ensure windows are closed before restarting
                setTimeout(() => {
                    performAutoLogin();
                }, 100);

                return; // Prevent the credWindow.close() below from running twice
            }

            credWindow.close();
        }
    });
}
