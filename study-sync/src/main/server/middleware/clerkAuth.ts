import { createLogger } from '@aryazos/ts-base/logging';
import type { RequestHandler } from 'express';
import { isAdminByGroups } from '../auth/adminConfig';
import { registerLoginAttempt } from '../auth/userDb';

const logger = createLogger('com.aryazos.study-sync.server.auth');

const shouldDisableAuth = (): boolean => {
    const value = process.env.STUDY_SYNC_DISABLE_AUTH;
    if (!value) return false;
    const normalized = value.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes';
};

/**
 * No-op middleware — Authentik ForwardAuth at the Traefik level handles
 * session validation and injects X-authentik-* headers before requests
 * reach this service.
 */
export const clerkAuthMiddleware: RequestHandler = (_req, _res, next) => {
    next();
};

export const requireClerkAuth: RequestHandler = async (req, res, next) => {
    if (!shouldDisableAuth()) {
        // Health endpoint is always open
        if (req.path === '/health') {
            return next();
        }

        const userId = req.headers['x-authentik-uid'] as string | undefined;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const email = req.headers['x-authentik-email'] as string | undefined;
        const name = req.headers['x-authentik-name'] as string | undefined;
        const groups = req.headers['x-authentik-groups'] as string | undefined;

        try {
            const user = await registerLoginAttempt(userId, email, name);
            if (!isAdminByGroups(groups) && !user.enabled) {
                logger.warn('Blocked request from disabled user', {
                    userId,
                    path: req.path,
                });
                return res.status(403).json({ error: 'Forbidden' });
            }
        } catch (error) {
            logger.error('Failed to register login attempt', {
                userId,
                error: error instanceof Error ? error.message : String(error),
            });
            return res.status(500).json({ error: 'AuthDatabaseError' });
        }
    }

    return next();
};

export const requireAdmin: RequestHandler = (req, res, next) => {
    if (!shouldDisableAuth()) {
        const userId = req.headers['x-authentik-uid'] as string | undefined;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const groups = req.headers['x-authentik-groups'] as string | undefined;
        if (!isAdminByGroups(groups)) {
            return res.status(403).json({ error: 'Forbidden' });
        }
    }

    return next();
};
