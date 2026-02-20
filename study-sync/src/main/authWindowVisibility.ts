export interface AuthWindowVisibilityOptions {
  hasCreds: boolean;
  autoLoginEnabled: boolean;
  showLoginWindow: boolean;
}

/**
 * Determines whether the auth/login window should be visible to the user.
 *
 * Rules:
 * - If we cannot auto-login (no creds or auto-login disabled), we must show the window.
 * - Otherwise, only show it if the user explicitly enabled “Show Login Window”.
 */
export function shouldShowAuthWindow(options: AuthWindowVisibilityOptions): boolean {
  const { hasCreds, autoLoginEnabled, showLoginWindow } = options;
  return !hasCreds || !autoLoginEnabled || showLoginWindow;
}
