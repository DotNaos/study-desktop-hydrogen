import { createLogger } from '@aryazos/ts-base/logging';
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { ensureStudySyncCacheDir } from '../../shared/paths';
import { MoodleCourse, MoodleResource } from './browser';

const logger = createLogger('com.aryazos.providers.moodle.cache');

interface MoodleCacheSchema {
    courses: MoodleCourse[];
    resources: [string, MoodleResource][]; // Store Map as array of entries
    loadedCourses: string[]; // IDs of courses that have been fully fetched
    courseContextIds?: [string, string][]; // courseId -> contextId
    timestamp: number;
}

const requireFromHere = createRequire(__filename);
let cachedElectronStore: any | null | undefined = undefined;

function getElectronStore(): any | null {
    if (cachedElectronStore !== undefined) {
        return cachedElectronStore;
    }
    if (!process.versions?.electron) {
        cachedElectronStore = null;
        return null;
    }

    try {
        const Store = requireFromHere('electron-store');
        cachedElectronStore = new Store<MoodleCacheSchema>({
            name: 'moodle-cache',
            encryptionKey: 'aryazos-study-sync-moodle-cache-key',
        });
        return cachedElectronStore;
    } catch (error) {
        logger.warn('Electron store unavailable for Moodle cache', { error });
        cachedElectronStore = null;
        return null;
    }
}

function getCacheFilePath(): string {
    return join(ensureStudySyncCacheDir(), 'moodle-cache.json');
}

function readCacheFile(): MoodleCacheSchema | null {
    try {
        const raw = readFileSync(getCacheFilePath(), 'utf-8');
        return JSON.parse(raw) as MoodleCacheSchema;
    } catch {
        return null;
    }
}

function writeCacheFile(data: MoodleCacheSchema): void {
    writeFileSync(getCacheFilePath(), JSON.stringify(data, null, 2), 'utf-8');
}

export function loadMoodleCache(): {
    courses: MoodleCourse[];
    resources: Map<string, MoodleResource>;
    loadedCourses: Set<string>;
    courseContextIds: Map<string, string>;
} | null {
    try {
        const store = getElectronStore();
        const data = store
            ? (store.store as MoodleCacheSchema)
            : readCacheFile();
        if (!data || !data.courses) return null; // Empty store

        logger.info('Loading Moodle cache', {
            courses: data.courses.length,
            resources: data.resources?.length,
            loaded: data.loadedCourses?.length,
            ageMs: Date.now() - (data.timestamp || 0),
        });

        return {
            courses: data.courses,
            resources: new Map(data.resources || []),
            loadedCourses: new Set(data.loadedCourses || []),
            courseContextIds: new Map(data.courseContextIds || []),
        };
    } catch (err) {
        logger.warn('Failed to load moodle cache', { err });
        return null;
    }
}

export function saveMoodleCache(
    courses: MoodleCourse[],
    resources: Map<string, MoodleResource>,
    loadedCourses: Set<string>,
    courseContextIds: Map<string, string>,
): void {
    try {
        const payload: MoodleCacheSchema = {
            courses,
            resources: Array.from(resources.entries()),
            loadedCourses: Array.from(loadedCourses),
            courseContextIds: Array.from(courseContextIds.entries()),
            timestamp: Date.now(),
        };
        const store = getElectronStore();
        if (store) {
            store.set(payload);
        } else {
            writeCacheFile(payload);
        }
        logger.debug('Saved Moodle cache to disk');
    } catch (err) {
        logger.error('Failed to save moodle cache', { err });
    }
}

export function clearMoodleCacheStore(): void {
    const store = getElectronStore();
    if (store) {
        store.clear();
        return;
    }
    try {
        unlinkSync(getCacheFilePath());
    } catch {
        return;
    }
}
