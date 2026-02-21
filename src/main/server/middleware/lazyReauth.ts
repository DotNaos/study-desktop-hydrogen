import { createLogger } from '@aryazos/ts-base/logging';
import { NextFunction, Request, Response } from 'express';
import {
    clearReauthPending,
    isMoodleAuthenticated,
    isReauthPending,
} from '../../moodle';
import { ProviderErrorCodes } from '../../types';

const logger = createLogger('com.aryazos.study-sync.server.middleware.reauth');

/**
 * Middleware for lazy session re-authentication.
 *
 * When session expires during a request, reauthPending is set.
 * On the next request, this middleware detects the pending reauth,
 * attempts to re-authenticate once, and clears the flag.
 */
export async function lazyReauthMiddleware(
    _req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    // If authenticated, no reauth needed
    if (isMoodleAuthenticated()) {
        next();
        return;
    }

    // If not authenticated and reauth is pending, attempt once
    if (isReauthPending()) {
        clearReauthPending(); // Only try once per session expiry

        logger.info('Session expired, attempting lazy re-authentication...');

        try {
            // Dynamic import to avoid circular dependency
            const { attemptReauth } = await import('../headless');
            const success = await attemptReauth();

            if (success) {
                logger.info('Lazy re-authentication succeeded');
                next();
                return;
            }

            logger.warn('Lazy re-authentication failed');
        } catch (error) {
            logger.error('Error during lazy re-authentication', { error });
        }
    }

    // Still not authenticated after reauth attempt (or no reauth pending)
    if (!isMoodleAuthenticated()) {
        res.status(401).json({
            error: ProviderErrorCodes.AUTH_REQUIRED,
            message: 'Not authenticated. Configure credentials in Study Sync.',
        });
        return;
    }

    next();
}
