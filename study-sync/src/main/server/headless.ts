import {
    createLogger,
    isChannelEnabled,
    registerLoggerBackend,
} from '@aryazos/ts-base/logging';
import pino from 'pino';
import { loginWithPuppeteer } from '../../cli/login';
import { loadCliSession, saveCliSession } from '../../cli/sessionStore';
import { setExportRoot } from '../downloader';
import {
    restoreMoodleSession,
    setMoodleCookies,
    setSelectedSchool,
} from '../moodle';
import { getDefaultSchool, getSchool } from '../schools';
import { startServer, stopServer } from './index';

const logger = createLogger('com.aryazos.study-sync.server.headless');
const DEFAULT_PORT = 3333;

const args = new Set(process.argv.slice(2));
if (args.has('--no-auth') || args.has('--disable-auth')) {
    process.env.STUDY_SYNC_DISABLE_AUTH = '1';
}

function parsePort(value: string | undefined): number | null {
    if (!value) return null;
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return null;
    if (parsed < 1 || parsed > 65535) return null;
    return parsed;
}

function registerHeadlessLogger(): void {
    const level =
        process.env['STUDY_SYNC_LOG_LEVEL'] ||
        process.env['LOG_LEVEL'] ||
        'info';
    const baseLogger = pino({ level });

    registerLoggerBackend({
        log: (channel, logLevel, event, message, data) => {
            const fullChannel = event ? `${channel}:${event}` : channel;
            if (!isChannelEnabled(fullChannel)) return;

            const child = baseLogger.child({ channel });
            const payload: Record<string, unknown> = {};
            if (event) payload.event = event;
            if (data !== undefined) payload.data = data;

            if (Object.keys(payload).length > 0) {
                child[logLevel](payload, message);
            } else {
                child[logLevel](message);
            }
        },
    });
}

function resolveSchoolId(envSchoolId?: string): string {
    if (envSchoolId) {
        const known = getSchool(envSchoolId);
        if (known) return known.id;
        logger.warn('Unknown school id, falling back to default', {
            envSchoolId,
        });
    }
    return getDefaultSchool().id;
}

async function configureExportRoot(): Promise<void> {
    const exportRoot = process.env['STUDY_SYNC_EXPORT_ROOT'];
    if (!exportRoot) return;

    try {
        await setExportRoot(exportRoot);
        logger.info('Export root configured', { exportRoot });
    } catch (error) {
        logger.error('Failed to set export root', { exportRoot, error });
    }
}

async function applySessionCookies(
    cookies: string,
    schoolId: string,
): Promise<boolean> {
    try {
        await setMoodleCookies(cookies, schoolId);
        await saveCliSession({ cookies, schoolId, updatedAt: Date.now() });
        logger.info('Applied Moodle session cookies', { schoolId });
        return true;
    } catch (error) {
        logger.error('Failed to apply session cookies', { schoolId, error });
        return false;
    }
}

async function restoreCachedSession(
    preferredSchoolId: string,
): Promise<boolean> {
    const cached = await loadCliSession();
    if (!cached) return false;

    const schoolId = cached.schoolId || preferredSchoolId;
    const restored = await restoreMoodleSession(cached.cookies, schoolId);
    if (restored) {
        logger.info('Restored Moodle session from cache', { schoolId });
        return true;
    }

    logger.warn('Cached Moodle session invalid, will re-authenticate', {
        schoolId,
    });
    return false;
}

async function loginWithCredentials(
    schoolId: string,
    username: string,
    password: string,
    headless: boolean,
): Promise<boolean> {
    try {
        const result = await loginWithPuppeteer({
            schoolId,
            username,
            password,
            headless,
        });

        return applySessionCookies(result.cookies, result.schoolId);
    } catch (error) {
        logger.error('Puppeteer login failed', {
            schoolId,
            error: error instanceof Error ? error.message : String(error),
        });
        return false;
    }
}

async function bootstrapAuth(): Promise<void> {
    const envSchoolId = process.env['STUDY_SYNC_SCHOOL_ID'];
    const schoolId = resolveSchoolId(envSchoolId);
    const cookies = process.env['STUDY_SYNC_COOKIES'] || '';
    const username = process.env['STUDY_SYNC_USERNAME'] || '';
    const password = process.env['STUDY_SYNC_PASSWORD'] || '';
    const headless = process.env['STUDY_SYNC_HEADLESS'] !== '0';
    const disableLogin = process.env['STUDY_SYNC_DISABLE_LOGIN'] === '1';

    setSelectedSchool(schoolId);

    if (cookies.trim().length > 0) {
        const ok = await applySessionCookies(cookies, schoolId);
        if (ok) return;
    }

    const restored = await restoreCachedSession(schoolId);
    if (restored) return;

    if (disableLogin) {
        logger.warn('Login disabled; running without Moodle authentication');
        return;
    }

    if (username.trim().length > 0 && password.trim().length > 0) {
        const ok = await loginWithCredentials(
            schoolId,
            username,
            password,
            headless,
        );
        if (ok) return;
    }

    logger.warn(
        'No Moodle credentials available; API will require manual session injection',
        {
            hasCookies: cookies.trim().length > 0,
            hasUsername: username.trim().length > 0,
            hasPassword: password.trim().length > 0,
        },
    );
}

/**
 * Attempt to re-authenticate. Called lazily from API routes when session expires.
 * @returns true if authentication succeeded, false otherwise
 */
export async function attemptReauth(): Promise<boolean> {
    logger.info('Attempting lazy re-authentication...');
    try {
        await bootstrapAuth();
        const { isMoodleAuthenticated } = await import('../moodle');
        const authenticated = isMoodleAuthenticated();
        logger.info('Re-authentication result', { authenticated });
        return authenticated;
    } catch (error) {
        logger.error('Re-authentication failed', { error });
        return false;
    }
}

async function main(): Promise<void> {
    registerHeadlessLogger();

    const port =
        parsePort(process.env['STUDY_SYNC_PORT']) ??
        parsePort(process.env['PORT']) ??
        DEFAULT_PORT;

    await configureExportRoot();
    startServer(port);

    bootstrapAuth().catch((error) => {
        logger.error('Auth bootstrap failed', { error });
    });

    const shutdown = () => {
        logger.info('Shutting down study-sync server');
        stopServer();
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    process.on('uncaughtException', (error) => {
        logger.error('Uncaught exception', { error });
    });
    process.on('unhandledRejection', (reason) => {
        logger.error('Unhandled rejection', { reason });
    });
}

void main();
