import { createLogger } from '@aryazos/ts-base/logging';
import { BrowserWindow } from 'electron';
import { icon as appIcon, hasIcon } from './appIcon';
import { shouldShowAuthWindow } from './authWindowVisibility';
import { getSchoolCredentials, getSelectedSchoolConfig, store } from './config';
import { openCredentialsDialog } from './credentialsWindow';
import { registerDockWindow } from './dock';
import { setMoodleCookies } from './moodle';
import { updateTrayMenu } from './tray';

const logger = createLogger('com.aryazos.study-sync.auth');

/** Track login attempts to prevent infinite loops */
let loginAttempts = 0;
const MAX_LOGIN_ATTEMPTS = 3;

let authWindow: BrowserWindow | null = null;

export function getAuthWindow(): BrowserWindow | null {
    return authWindow;
}

export function closeAuthWindow(): void {
    if (authWindow) {
        authWindow.close();
        authWindow = null;
    }
}

export async function performAutoLogin(): Promise<void> {
    const school = getSelectedSchoolConfig();
    const creds = getSchoolCredentials();

    // Read preferences
    const autoLoginEnabled = store.get('preferences.autoLogin', true);
    const showLoginWindow = store.get('preferences.showLoginWindow', false);

    // Determine if we have valid credentials
    const hasCreds = !!(creds.username && creds.password);

    logger.info('Starting login flow', {
        schoolId: school.id,
        schoolName: school.name,
    });

    if (authWindow) {
        authWindow.focus();
        return;
    }

    // Reset attempt counter for new login session
    loginAttempts = 0;

    // VISIBILITY LOGIC
    // Force visible if:
    // 1. No credentials (need manual config)
    // 2. Auto-login disabled (manual login)
    // 3. User explicitly wants to see it
    const isVisible = shouldShowAuthWindow({
        hasCreds,
        autoLoginEnabled,
        showLoginWindow,
    });

    authWindow = new BrowserWindow({
        width: 800,
        height: 700,
        title: `${school.name} Login`,
        show: isVisible,
        ...(hasIcon ? { icon: appIcon } : {}),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        },
    });
    registerDockWindow(authWindow);

    // Intercept "study-sync://configure-creds" navigation from the injected header
    authWindow.webContents.on('will-navigate', (event, url) => {
        if (url.startsWith('study-sync://configure-creds')) {
            event.preventDefault();
            openCredentialsDialog();
        }
    });

    // Load the school's login URL
    authWindow.loadURL(school.loginUrl);

    // Wait for page to load, then inject header and/or auto-fill
    authWindow.webContents.on('did-finish-load', async () => {
        const url = authWindow?.webContents.getURL() || '';

        // INJECT HEADER if needed
        // Show if: No credentials OR Auto-login disabled
        if (!hasCreds || !autoLoginEnabled) {
            const message = !hasCreds
                ? '💡 You can configure auto-login to skip this step.'
                : '💡 Auto-login is disabled. Enable in tray settings.';

            const css = `
        body { margin-top: 50px !important; transition: margin-top 0.3s; }
        #study-sync-login-header {
          position: fixed; top: 0; left: 0; right: 0; height: 52px; z-index: 2147483647;
          background: #2563eb; color: white; padding: 0 16px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          box-sizing: border-box; font-size: 14px; border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        .study-sync-header-content { display: flex; align-items: center; gap: 10px; font-weight: 500; }
        .study-sync-icon { width: 18px; height: 18px; stroke-width: 2.5; }
        #study-sync-config-btn {
          background: white; color: #2563eb; border: none; padding: 0 16px; height: 32px; border-radius: 6px;
          cursor: pointer; font-weight: 600; font-size: 13px; transition: all 0.2s;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 1px 2px rgba(0,0,0,0.1);
        }
        #study-sync-config-btn:hover { background: #f8fafc; transform: translateY(-1px); }
        #study-sync-config-btn:active { transform: translateY(0); }
      `;

            // Lucide 'Lightbulb' icon SVG
            const lightbulbIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" class="study-sync-icon"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-1 1.5-2 1.5-3.5A6 6 0 0 0 6 8c0 1 .5 2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>`;

            const js = `
        if (!document.getElementById('study-sync-login-header')) {
          const header = document.createElement('div');
          header.id = 'study-sync-login-header';
          header.innerHTML = \`
            <div class="study-sync-header-content">
              ${lightbulbIcon}
              <span>${message.replace('💡 ', '')}</span>
            </div>
            <button id="study-sync-config-btn" onclick="window.location.href='study-sync://configure-creds'">Configure Auto Login</button>
          \`;
          document.body.appendChild(header);

          const style = document.createElement('style');
          style.textContent = \`${css}\`;
          document.head.appendChild(style);
        }
      `;

            authWindow?.webContents.executeJavaScript(js).catch(() => {});
        }

        // AUTO-FILL LOGIC
        // Only proceed if auto-login is ENABLED and we have CREDS
        if (!autoLoginEnabled || !hasCreds) {
            return;
        }

        // Check if on a known login page
        // Include eduid.ch for PHGR SSO, aai-login for FHGR SSO
        if (
            url.includes('login') ||
            url.includes('sso') ||
            url.includes('keycloak') ||
            url.includes('eduid') ||
            url.includes('aai-login')
        ) {
            loginAttempts++;

            // If too many attempts, show window for manual login (if not already visible)
            if (loginAttempts > MAX_LOGIN_ATTEMPTS) {
                logger.warn('Auto-login failed', {
                    maxAttempts: MAX_LOGIN_ATTEMPTS,
                    showLoginWindowPreference: showLoginWindow,
                });

                // Respect the user preference: if they opted to keep the login window hidden,
                // do not force-reveal it just because auto-login exceeded retries.
                if (isVisible && !authWindow?.isVisible()) {
                    authWindow?.show();
                } else if (!isVisible) {
                    logger.info('Login window kept hidden due to preference', {
                        reason: 'auto-login-max-attempts',
                    });
                }
                return;
            }

            logger.debug('Filling login form', {
                url,
                attempt: loginAttempts,
                maxAttempts: MAX_LOGIN_ATTEMPTS,
            });

            // Use school-specific selectors
            const { username, password } = creds;
            await authWindow?.webContents
                .executeJavaScript(
                    `
        (function() {
          const usernameField = document.querySelector('${school.selectors.username}');
          const passwordField = document.querySelector('${school.selectors.password}');

          // Find submit button by selector OR by text content (for "Continue" button)
          let submitBtn = document.querySelector('${school.selectors.submit}');
          if (!submitBtn) {
            // Try to find by text content
            const buttons = document.querySelectorAll('button');
            for (const btn of buttons) {
              const text = btn.textContent?.toLowerCase() || '';
              if (text.includes('continue') || text.includes('weiter') || text.includes('login') || text.includes('anmelden')) {
                submitBtn = btn;
                break;
              }
            }
          }

          // Two-step login: check if username/email field is visible (step 1)
          if (usernameField && !passwordField) {
            usernameField.value = ${JSON.stringify(username)};
            usernameField.dispatchEvent(new Event('input', { bubbles: true }));
            usernameField.dispatchEvent(new Event('change', { bubbles: true }));
            if (submitBtn) {
              setTimeout(() => submitBtn.click(), 500);
            }
            return 'filled-email';
          }

          // Step 2: password field visible
          if (passwordField && !usernameField) {
            passwordField.value = ${JSON.stringify(password)};
            passwordField.dispatchEvent(new Event('input', { bubbles: true }));
            passwordField.dispatchEvent(new Event('change', { bubbles: true }));
            if (submitBtn) {
              setTimeout(() => submitBtn.click(), 500);
            }
            return 'filled-password';
          }

          // Both fields visible (traditional login)
          if (usernameField && passwordField) {
            usernameField.value = ${JSON.stringify(username)};
            passwordField.value = ${JSON.stringify(password)};
            usernameField.dispatchEvent(new Event('input', { bubbles: true }));
            passwordField.dispatchEvent(new Event('input', { bubbles: true }));
            if (submitBtn) {
              setTimeout(() => submitBtn.click(), 500);
            }
            return 'filled-both';
          }

          return 'not-found';
        })();
      `,
                )
                .then((result) => {
                    logger.debug('Form fill result', { result });
                })
                .catch((err) => {
                    logger.warn('Form fill error', { error: err });
                });
        }
    });

    // Listen for successful login (redirect to dashboard)
    authWindow.webContents.on('did-navigate', async (_event, url) => {
        logger.debug('Navigated to URL', { url });

        if (url.includes('/my/') || url.includes('dashboard')) {
            // Get cookies from the school's Moodle URL
            const cookies = await authWindow!.webContents.session.cookies.get({
                url: school.moodleUrl,
            });

            const cookieString = cookies
                .map((c) => `${c.name}=${c.value}`)
                .join('; ');

            // Send cookies to the provider with school ID
            await setMoodleCookies(cookieString, school.id);

            logger.info('Login successful', {
                schoolId: school.id,
                schoolName: school.name,
            });

            updateTrayMenu();
            authWindow!.close();
        }
    });

    authWindow.on('closed', () => {
        authWindow = null;
        loginAttempts = 0;
    });
}
