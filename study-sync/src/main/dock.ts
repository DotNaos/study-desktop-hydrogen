import { createLogger } from '@aryazos/ts-base/logging';
import { app, BrowserWindow } from 'electron';
import { hasIcon, icon } from './appIcon';

const logger = createLogger('com.aryazos.study-sync.dock');

export function showDockIcon(): void {
    if (process.platform !== 'darwin' || !app.dock) return;
    if (hasIcon) {
        app.dock.setIcon(icon);
    }
    app.dock.show();
}

export function hideDockIfIdle(): void {
    if (process.platform !== 'darwin' || !app.dock) return;
    const anyVisible = BrowserWindow.getAllWindows().some((window) =>
        window.isVisible(),
    );
    if (!anyVisible) {
        app.dock.hide();
        logger.debug('Dock icon hidden (no visible windows)');
    }
}

export function registerDockWindow(window: BrowserWindow): void {
    window.on('show', () => showDockIcon());
    window.on('hide', () => hideDockIfIdle());
    window.on('closed', () => hideDockIfIdle());
}
