import { createLogger } from '@aryazos/ts-base/logging';
import { BrowserWindow } from 'electron';
import { join } from 'path';
import { icon as appIcon, hasIcon } from './appIcon';
import { store } from './config';
import { registerDockWindow } from './dock';
import { updateTrayMenu } from './tray';

const logger = createLogger('com.aryazos.study-sync.calendar');

function applyCalendarUrl(rawValue: string): void {
    const trimmed = rawValue.trim();
    if (trimmed) {
        store.set('preferences.calendarUrl', trimmed);
        process.env.STUDY_SYNC_CALENDAR_URL = trimmed;
        logger.info('Calendar URL updated');
    } else {
        store.delete('preferences.calendarUrl');
        delete process.env.STUDY_SYNC_CALENDAR_URL;
        logger.info('Calendar URL cleared');
    }
    updateTrayMenu();
}

export async function openCalendarConfigDialog(): Promise<void> {
    const existing =
        store.get('preferences.calendarUrl') ??
        process.env.STUDY_SYNC_CALENDAR_URL ??
        '';

    const calendarWindow = new BrowserWindow({
        width: 360,
        height: 210,
        useContentSize: true,
        title: 'Calendar Feed',
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
    registerDockWindow(calendarWindow);

    const query = new URLSearchParams();
    query.set('view', 'calendar');
    if (existing) query.set('url', existing);

    const devUrl = process.env['ELECTRON_RENDERER_URL'];
    if (devUrl) {
        calendarWindow.loadURL(`${devUrl}?${query.toString()}`);
    } else {
        calendarWindow.loadFile(join(__dirname, '../renderer/index.html'), {
            search: query.toString(),
        });
    }

    calendarWindow.webContents.on('will-navigate', (event, url) => {
        if (!url.startsWith('save-calendar://')) return;
        event.preventDefault();
        const encoded = url.replace('save-calendar://', '');
        const decoded = decodeURIComponent(encoded || '');
        applyCalendarUrl(decoded);
        calendarWindow.close();
    });
}
