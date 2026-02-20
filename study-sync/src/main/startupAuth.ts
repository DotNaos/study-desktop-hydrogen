import { createLogger } from '@aryazos/ts-base/logging';
import dotenv from 'dotenv';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { loginWithPuppeteer } from '../cli/login';
import { store } from './config';
import {
    isMoodleAuthenticated,
    onMoodleCookiesChanged,
    restoreMoodleSession,
    setMoodleCookies,
    setSelectedSchool,
} from './moodle';
import { getDefaultSchool, getSchool } from './schools';

const logger = createLogger('com.aryazos.study-sync.startup-auth');

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

let envLoaded = false;

function loadUserEnv(): void {
    if (envLoaded) {
        return;
    }

    const userEnvPath = resolve(homedir(), '.env');
    dotenv.config({ path: userEnvPath, override: false });
    envLoaded = true;
}

function resolveSchoolId(): string {
    const envSchoolId = process.env.STUDY_SYNC_SCHOOL_ID;
    if (envSchoolId && getSchool(envSchoolId)) {
        return envSchoolId;
    }

    const storedSchool = store.get('selectedSchool');
    if (storedSchool && getSchool(storedSchool)) {
        return storedSchool;
    }

    return getDefaultSchool().id;
}

function resolveEffectiveSchoolId(explicitSchoolId?: string): string {
    if (explicitSchoolId && getSchool(explicitSchoolId)) {
        return explicitSchoolId;
    }
    return resolveSchoolId();
}

export function createCredentialsHash(
    username: string,
    password: string,
): string {
    return createHash('sha256')
        .update(`${username}\n${password}`)
        .digest('hex');
}

function resolveCredentials(schoolId: string): {
    username: string;
    password: string;
} | null {
    const username =
        process.env.STUDY_SYNC_USERNAME ||
        process.env.OS_STUDY_USERNAME ||
        process.env.MOODLE_USERNAME ||
        store.get(`schools.${schoolId}.username`) ||
        '';
    const password =
        process.env.STUDY_SYNC_PASSWORD ||
        process.env.OS_STUDY_PASSWORD ||
        process.env.MOODLE_PASSWORD ||
        store.get(`schools.${schoolId}.password`) ||
        '';

    if (!username.trim() || !password.trim()) {
        return null;
    }

    return { username: username.trim(), password: password.trim() };
}

async function restoreSessionIfAvailable(schoolId: string): Promise<boolean> {
    const moodleSession = store.get('moodleSession');
    if (!moodleSession?.cookies) {
        return false;
    }

    if (Date.now() - moodleSession.timestamp > SESSION_TTL_MS) {
        logger.info('Stored Moodle session expired, clearing cached session');
        store.delete('moodleSession');
        return false;
    }

    const effectiveSchoolId = moodleSession.schoolId || schoolId;
    const restored = await restoreMoodleSession(
        moodleSession.cookies,
        effectiveSchoolId,
    );

    if (!restored) {
        store.delete('moodleSession');
        return false;
    }

    logger.info('Restored Moodle session from encrypted store', {
        schoolId: effectiveSchoolId,
    });
    return true;
}

export function registerSessionPersistence(): void {
    onMoodleCookiesChanged((cookies, schoolId) => {
        store.set('moodleSession', {
            cookies,
            schoolId,
            timestamp: Date.now(),
        });
    });
}

interface AuthenticateCredentialsInput {
    username: string;
    password: string;
    schoolId?: string;
}

async function authenticateAndPersist(
    schoolId: string,
    username: string,
    password: string,
): Promise<{ schoolId: string; credentialsHash: string }> {
    const result = await loginWithPuppeteer({
        schoolId,
        username,
        password,
        headless: true,
        timeoutMs: 120_000,
    });

    await setMoodleCookies(result.cookies, result.schoolId);

    const credentialsHash = createCredentialsHash(username, password);
    store.set(`schools.${result.schoolId}.username`, username);
    store.set(`schools.${result.schoolId}.password`, password);
    store.set(`schools.${result.schoolId}.credentialsHash`, credentialsHash);
    store.set('selectedSchool', result.schoolId);
    store.set('moodleSession', {
        cookies: result.cookies,
        schoolId: result.schoolId,
        timestamp: Date.now(),
    });

    return {
        schoolId: result.schoolId,
        credentialsHash,
    };
}

export async function authenticateMoodleCredentials(
    input: AuthenticateCredentialsInput,
): Promise<{ schoolId: string; credentialsHash: string }> {
    const username = input.username.trim();
    const password = input.password.trim();
    if (!username || !password) {
        throw new Error('USERNAME_PASSWORD_REQUIRED');
    }

    const schoolId = resolveEffectiveSchoolId(input.schoolId);
    setSelectedSchool(schoolId);
    store.set('selectedSchool', schoolId);
    return authenticateAndPersist(schoolId, username, password);
}

export async function bootstrapMoodleAuth(): Promise<boolean> {
    loadUserEnv();

    const schoolId = resolveSchoolId();
    setSelectedSchool(schoolId);
    store.set('selectedSchool', schoolId);

    if (await restoreSessionIfAvailable(schoolId)) {
        return true;
    }

    const credentials = resolveCredentials(schoolId);
    if (!credentials) {
        logger.warn('No Moodle credentials found in env or store. API will stay unauthenticated.', {
            schoolId,
            userEnvPath: resolve(homedir(), '.env'),
        });
        return false;
    }

    try {
        const result = await authenticateAndPersist(
            schoolId,
            credentials.username,
            credentials.password,
        );

        logger.info('Moodle authentication bootstrap completed', {
            schoolId: result.schoolId,
            authenticated: isMoodleAuthenticated(),
        });
        return true;
    } catch (error) {
        logger.error('Moodle authentication bootstrap failed', {
            schoolId,
            error: error instanceof Error ? error.message : String(error),
        });
        return false;
    }
}
