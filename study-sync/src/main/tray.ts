import { app, BrowserWindow, dialog, Menu, nativeImage, shell, Tray } from "electron";
import { join } from "path";
import { performAutoLogin } from "./authentication";
import { openCalendarConfigDialog } from "./calendarWindow";
import { getSelectedSchoolConfig, hasCredentials, PORT, store } from "./config";
import { openCredentialsDialog } from "./credentialsWindow";
import { openDownloaderWindow } from "./downloaderWindow";
import { clearMoodleAuth, clearMoodleCache, isMoodleAuthenticated, setSelectedSchool } from "./moodle";
import { openMobilePairingWindow } from "./pairingWindow";
import { remoteCache } from "./remoteCache";
import { SCHOOLS } from "./schools";
import { stopServer } from "./server";

let tray: Tray | null = null;

export function createTray(): void {
  const iconPath = join(__dirname, "../../resources/trayTemplate.png");
  const icon = nativeImage.createFromPath(iconPath);
  icon.setTemplateImage(true);

  tray = new Tray(icon);
  tray.setToolTip("Study Sync");

  updateTrayMenu();
}

export function updateTrayMenu(): void {
  if (!tray) return;

  const school = getSelectedSchoolConfig();
  const hasCreds = hasCredentials();
  const isLoggedIn = isMoodleAuthenticated();

  // Preferences
  const autoLogin = store.get("preferences.autoLogin", true);
  const showLoginWindow = store.get("preferences.showLoginWindow", false);
  const darkMode = store.get("preferences.darkMode", false);
  const calendarUrl = store.get("preferences.calendarUrl")
    ?? process.env.STUDY_SYNC_CALENDAR_URL
    ?? "";

  const calendarSummary = (() => {
    const trimmed = calendarUrl.trim();
    if (!trimmed) return "not set";
    if (trimmed.length <= 48) return trimmed;
    return `${trimmed.slice(0, 45)}...`;
  })();

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Study Sync",
      enabled: false,
    },
    { type: "separator" },
    {
      label: `Server: http://localhost:${PORT}`,
      enabled: false,
    },
    {
      label: isLoggedIn ? `✓ Connected to ${school.name}` : "✗ Not connected",
      enabled: false,
    },
    { type: "separator" },

    // PAIRING
    {
      label: "Pair iPad…",
      click: () => openMobilePairingWindow(PORT),
    },
    {
      label: "Downloader…",
      click: () => openDownloaderWindow(PORT),
    },

    // PRIMARY ACTION
    {
      label: isLoggedIn ? `Reconnect` : `Login`,
      click: () => performAutoLogin(),
    },

    // SETTINGS SUBMENU
    {
      label: "Settings",
      submenu: [
        {
          label: `Auto-Login`,
          type: "checkbox",
          checked: autoLogin,
          click: () => {
            store.set("preferences.autoLogin", !autoLogin);
            updateTrayMenu();
          }
        },
        {
          label: `Show Login Window`,
          type: "checkbox",
          checked: showLoginWindow,
          enabled: autoLogin && hasCreds, // Disabled (forced visible) if no auto-login or no creds
          click: () => {
            store.set("preferences.showLoginWindow", !showLoginWindow);
            updateTrayMenu();
          }
        },
        {
          label: `Dark Mode`,
          type: "checkbox",
          checked: darkMode,
          click: () => {
            store.set("preferences.darkMode", !darkMode);
            updateTrayMenu();
            // Notify open windows
            BrowserWindow.getAllWindows().forEach((win) => {
              win.webContents.send("study-sync:theme-changed", !darkMode);
            });
          }
        },
        { type: "separator" },
        {
          label: `Calendar URL: ${calendarSummary}`,
          enabled: false,
        },
        {
          label: "Configure Calendar URL...",
          click: () => openCalendarConfigDialog(),
        },
        { type: "separator" },
        {
          label: "Configure Credentials...",
          click: () => openCredentialsDialog(),
        },
        {
          label: `School: ${school.name}`,
          submenu: SCHOOLS.map((s) => ({
            label: s.name,
            type: "radio" as const,
            checked: s.id === school.id,
            click: () => {
              store.set("selectedSchool", s.id);
              setSelectedSchool(s.id);
              updateTrayMenu();
            },
          })),
        },
      ]
    },

    // TOOLS SUBMENU
    {
      label: "Tools",
      submenu: [
        {
          label: "Clear Credentials",
          enabled: hasCreds,
          click: () => {
             const s = getSelectedSchoolConfig();
             store.delete(`schools.${s.id}` as any);
             updateTrayMenu();
          }
        },
        {
          label: `Clear ${school.name} Cache`,
          click: async () => {
            const { response } = await dialog.showMessageBox({
              type: "warning",
              buttons: ["Cancel", "Clear"],
              defaultId: 0,
              title: "Clear Moodle Cache",
              message: `Clear Moodle cache for ${school.name}?`,
              detail: `This will re-download all resources next time.`,
            });
            if (response === 1) {
              clearMoodleCache();
              updateTrayMenu();
            }
          },
        },
        {
          label: "Clear All Cache...",
          click: async () => {
            const stats = await remoteCache.getStats();
            const { response } = await dialog.showMessageBox({
              type: "warning",
              buttons: ["Cancel", "Clear All"],
              defaultId: 0,
              title: "Clear All Cache",
              message: `Delete ${stats.nodes} cached nodes and ${stats.files} files?`,
            });
            if (response === 1) {
              await remoteCache.clearAll();
              clearMoodleAuth();
              updateTrayMenu();
            }
          },
        },
        { type: "separator" },
        {
          label: "Reveal Sync Data",
          click: () => {
            // Open the Electron userData folder where all study-sync caches live
            const userDataPath = app.getPath("userData");
            shell.openPath(userDataPath);
          },
        },

      ]
    },

    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        stopServer();
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}
