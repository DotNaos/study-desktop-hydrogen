import { createLogger } from '@aryazos/ts-base/logging';
import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { getAuthWindow, performAutoLogin } from './authentication';
import { migrateCredentials, PORT, store } from './config';
import { setExportRoot as setDownloaderRoot } from './downloader';
import { openDownloaderWindow } from './downloaderWindow';
import {
    clearMoodleAuth,
    isMoodleAuthenticated,
    onMoodleCookiesChanged,
    onMoodleSessionExpired,
    setMoodleCookies,
    setSelectedSchool,
} from './moodle';
import { startServer, stopServer } from './server';
import { createTray, updateTrayMenu } from './tray';

const logger = createLogger('com.aryazos.study-sync.main');

if (process.versions?.electron) {
    process.env.STUDY_SYNC_DISABLE_AUTH =
        process.env.STUDY_SYNC_DISABLE_AUTH ?? '1';
}

// Global reference to prevent GC
// Tray is managed in tray.ts module
// AuthWindow is managed in authentication.ts module
// Server is managed in server/index.ts module

// Set app name BEFORE whenReady() - required for macOS dock label
// Using both methods to ensure it works in dev mode
app.setName('aryazos-study-sync');

app.whenReady().then(async () => {
    // Hide dock icon on macOS - it will show when windows are opened
    if (process.platform === 'darwin' && app.dock) {
        app.dock.hide();
    }

    // 1. Migrate credentials if needed
    migrateCredentials();

    // 2. Initialize store / selected school
    const savedSchool = store.get('selectedSchool', 'fhgr');
    setSelectedSchool(savedSchool);

    const savedCalendarUrl = store.get('preferences.calendarUrl');
    if (savedCalendarUrl) {
        process.env.STUDY_SYNC_CALENDAR_URL = savedCalendarUrl;
    }

    // 3. Initialize downloader
    const savedExportRoot = store.get('exportRoot');
    if (savedExportRoot) {
        try {
            await setDownloaderRoot(savedExportRoot);
        } catch (e) {
            logger.error('Failed to restore downloader root', {
                error: e instanceof Error ? e.message : String(e),
            });
        }
    }

    // 4. Create Tray
    createTray();

    // 5. Register session-expired handler
    onMoodleSessionExpired(() => {
        updateTrayMenu();
        if (!store.get('preferences.autoLogin', true)) {
            return;
        }
        performAutoLogin();
    });

    // 6. Restore session from store
    const moodleSession = store.get('moodleSession');
    if (moodleSession) {
        // Check expiration (24h)
        if (Date.now() - moodleSession.timestamp < 24 * 60 * 60 * 1000) {
            await setMoodleCookies(
                moodleSession.cookies,
                moodleSession.schoolId,
            );
            updateTrayMenu();
        } else {
            store.delete('moodleSession');
            clearMoodleAuth();
        }
    }

    // 7. Start API Server
    startServer(PORT);

    // 8. Auto-Login
    // Only auto-login if no active session and preference set
    if (!isMoodleAuthenticated() && store.get('preferences.autoLogin', true)) {
        performAutoLogin();
    }

    // 9. Listen for cookie changes to persist session & update tray
    onMoodleCookiesChanged((cookies: string, schoolId: string) => {
        store.set('moodleSession', {
            cookies,
            schoolId,
            timestamp: Date.now(),
        });
        updateTrayMenu();
    });
});

app.on('before-quit', () => {
    stopServer();
});

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        // If we have an auth window logic, we might need to restore it?
        // Currently we rely on tray.
        const authWin = getAuthWindow();
        if (authWin) authWin.show();
    }
});

// ============================================================================
// IPC Handlers
// ============================================================================

ipcMain.on('login-success', () => {
    // Renderer process signaled success
    performAutoLogin(); // Re-trigger check
});

ipcMain.on('open-external', (_event, url) => {
    shell.openExternal(url);
});

// Helper for UI to request re-login
ipcMain.handle('trigger-login', () => {
    return performAutoLogin();
});

ipcMain.handle('open-downloader', () => {
    return openDownloaderWindow(PORT);
});

ipcMain.handle('study-sync:getTheme', () => {
    return { mode: store.get('preferences.darkMode') ? 'dark' : 'light' };
});
