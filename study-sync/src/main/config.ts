import { createLogger } from '@aryazos/ts-base/logging';
import Store from 'electron-store';
import { getDefaultSchool, getSchool, SchoolConfig } from './schools';

const logger = createLogger('com.aryazos.study-sync.config');

const DEFAULT_PORT = 3333;

function parsePort(value: string | undefined): number | undefined {
    if (!value) return undefined;
    const port = Number.parseInt(value, 10);
    if (!Number.isFinite(port)) return undefined;
    if (port < 1 || port > 65535) return undefined;
    return port;
}

export const PORT = (() => {
    const fromEnv = parsePort(process.env['STUDY_SYNC_PORT']);
    if (!process.env['STUDY_SYNC_PORT']) return DEFAULT_PORT;
    if (fromEnv) return fromEnv;
    logger.warn('Invalid STUDY_SYNC_PORT; falling back to default', {
        value: process.env['STUDY_SYNC_PORT'],
        defaultPort: DEFAULT_PORT,
    });
    return DEFAULT_PORT;
})();

// Store schema with multi-school support
export interface StoreSchema {
    selectedSchool?: string;
    schools: Record<string, { username?: string; password?: string }>;
    // Legacy format for migration
    moodle?: { username?: string; password?: string };
    exportRoot?: string;
    // Session persistence
    moodleSession?: {
        cookies: string;
        schoolId: string;
        timestamp: number;
    };
    preferences: {
        autoLogin: boolean;
        showLoginWindow: boolean;
        darkMode: boolean;
        calendarUrl?: string;
    };
}

export const store = new Store<StoreSchema>({
    name: 'credentials',
    encryptionKey: 'aryazos-study-sync-secure-key',
});

// ============================================================================
// Helper Functions
// ============================================================================

/** Get the currently selected school config */
export function getSelectedSchoolConfig(): SchoolConfig {
    const schoolId = store.get('selectedSchool');
    return (schoolId && getSchool(schoolId)) || getDefaultSchool();
}

/** Get credentials for the selected school */
export function getSchoolCredentials(): {
    username?: string;
    password?: string;
} {
    const school = getSelectedSchoolConfig();
    return store.get(`schools.${school.id}`) || {};
}

/** Check if credentials exist for the selected school */
export function hasCredentials(): boolean {
    const creds = getSchoolCredentials();
    return !!(creds.username && creds.password);
}

/** Migrate old moodle.* credentials to schools.fhgr.* */
export function migrateCredentials(): void {
    const oldUsername = store.get('moodle.username' as keyof StoreSchema) as
        | string
        | undefined;
    const oldPassword = store.get('moodle.password' as keyof StoreSchema) as
        | string
        | undefined;

    if (oldUsername && oldPassword) {
        logger.info('Migrating legacy credentials to new format');
        store.set('schools.fhgr.username', oldUsername);
        store.set('schools.fhgr.password', oldPassword);
        store.set('selectedSchool', 'fhgr');
        store.delete('moodle');
        logger.info('Migration complete');
    }
}
