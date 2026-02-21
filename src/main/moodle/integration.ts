import { Note } from '@aryazos/study/types';
import { createLogger } from '@aryazos/ts-base/logging';
import { remoteCache } from '../remoteCache';
import { getSchool } from '../schools';
import { MoodleCourse } from './browser';
import { loadMoodleCache, saveMoodleCache } from './cache';
import { makeMoodleCourseId } from './ids';
import { moodleProvider } from './provider';
import { createFetcher, state } from './state';

const logger = createLogger('com.aryazos.providers.moodle.integration');

// ============================================================================
// Helper functions for Electron integration
// ============================================================================

/** Callback for cookie persistence */
let onCookiesChangedCallback:
    | ((cookies: string, schoolId: string) => void)
    | null = null;
/** Callback for session-expired handling */
let onSessionExpiredCallback: (() => void) | null = null;
let sessionExpiredHandled = false;
/** Flag to trigger lazy re-authentication on next request */
let reauthPending = false;

function handleSessionExpired(source: string, error?: Error): void {
    if (sessionExpiredHandled) {
        logger.debug('Session expired already handled', { source });
        return;
    }

    sessionExpiredHandled = true;
    reauthPending = true;
    logger.warn('Session expired, clearing auth state', {
        source,
        error: error?.message,
    });

    state.isAuthenticated = false;
    state.courses = [];
    onSessionExpiredCallback?.();
}

/**
 * Check if re-authentication should be attempted on next request.
 */
export function isReauthPending(): boolean {
    return reauthPending;
}

/**
 * Clear the re-auth pending flag (call after attempting re-auth).
 */
export function clearReauthPending(): void {
    reauthPending = false;
}

function resetSessionExpiredHandling(reason: string): void {
    if (!sessionExpiredHandled) {
        return;
    }

    sessionExpiredHandled = false;
    logger.debug('Reset session-expired handling', { reason });
}

function attachSessionExpiredHandler(): void {
    state.fetcher.setSessionExpiredHandler((error) => {
        handleSessionExpired('fetcher', error);
    });
}

attachSessionExpiredHandler();

/**
 * Register a callback to be notified when cookies change.
 */
export function onMoodleCookiesChanged(
    callback: (cookies: string, schoolId: string) => void,
): void {
    onCookiesChangedCallback = callback;
}

export function onMoodleSessionExpired(callback: () => void): void {
    onSessionExpiredCallback = callback;
}

/**
 * Set cookies received from Electron BrowserWindow.
 */
export async function setMoodleCookies(
    cookies: string,
    schoolId?: string,
    options?: { skipFetch?: boolean },
): Promise<void> {
    // Update school
    if (schoolId) {
        const school = getSchool(schoolId);
        if (school) {
            state.selectedSchool = school;
            state.fetcher = createFetcher(school);
            attachSessionExpiredHandler();
            logger.info('Switched to school', {
                schoolId,
                moodleUrl: school.moodleUrl,
            });
        }
    }

    resetSessionExpiredHandling('setMoodleCookies');
    logger.debug('Setting cookies', {
        length: cookies.length,
        school: state.selectedSchool.id,
    });
    state.fetcher.setCookies(cookies);
    state.isAuthenticated = true;

    // Load cache immediately so UI has data
    hydrateFromCache();

    // Notify listeners (for persistence)
    onCookiesChangedCallback?.(cookies, state.selectedSchool.id);

    if (options?.skipFetch) {
        logger.debug('Skipping course fetch (session restore)');
        return;
    }

    // Fetch courses in background or foreground
    const hasCache = state.courses.length > 0;

    const fetchPromise = (async () => {
        logger.debug('Fetching courses...');
        try {
            const courses = await state.fetcher.fetchCourses();
            state.courses = courses;
            logger.info('Fetched courses', { count: state.courses.length });

            // Save updated course list to cache
            saveMoodleCache(
                state.courses,
                state.resources,
                state.loadedCourses,
                state.courseContextIds,
            );

            return courses;
        } catch (error) {
            const errorCode = (error as any)?.code;
            if (errorCode === 'SESSION_EXPIRED') {
                handleSessionExpired('fetchCourses', error as Error);
            }
            throw error;
        }
    })();

    if (!hasCache) {
        // No cache? Wait for fetch.
        await fetchPromise;
    } else {
        // Have cache? Let fetch run in background.
        fetchPromise.catch((err) =>
            logger.error('Background course fetch failed', err),
        );
    }
}

/**
 * Restore a Moodle session from saved cookies.
 * Validates the session before accepting it.
 * @returns true if session was restored successfully, false if expired/invalid
 */
export async function restoreMoodleSession(
    cookies: string,
    schoolId: string,
): Promise<boolean> {
    logger.info('Attempting to restore Moodle session', { schoolId });

    // Set up school and cookies without fetching courses yet
    const school = getSchool(schoolId);
    if (!school) {
        logger.warn('Unknown school ID for session restore', { schoolId });
        return false;
    }

    state.selectedSchool = school;
    state.fetcher = createFetcher(school);
    attachSessionExpiredHandler();
    state.fetcher.setCookies(cookies);
    resetSessionExpiredHandling('restoreMoodleSession');

    // Load cache immediately (optimistic restore)
    hydrateFromCache();

    // Validate the session
    const isValid = await state.fetcher.validateSession();

    if (isValid) {
        state.isAuthenticated = true;
        logger.info('Session restored successfully', { schoolId });

        // Fetch courses in background (don't block)
        state.fetcher
            .fetchCourses()
            .then((courses) => {
                state.courses = courses;
                logger.info('Background course fetch complete', {
                    count: courses.length,
                });
                saveMoodleCache(
                    state.courses,
                    state.resources,
                    state.loadedCourses,
                    state.courseContextIds,
                );
            })
            .catch((err) => {
                logger.warn('Background course fetch failed', { error: err });
            });

        return true;
    }

    logger.info('Saved session is expired/invalid', { schoolId });
    state.isAuthenticated = false; // Ensure false if validation failed
    return false;
}

function hydrateFromCache() {
    const cached = loadMoodleCache();
    if (cached) {
        state.courses = cached.courses;
        state.resources = cached.resources;
        state.loadedCourses = cached.loadedCourses;
        state.courseContextIds = cached.courseContextIds;
        logger.info('Hydrated state from disk cache', {
            courses: state.courses.length,
            resources: state.resources.size,
            loadedCourses: state.loadedCourses.size,
            contextIds: state.courseContextIds.size,
        });
    }
}

/**
 * Check if Moodle is authenticated.
 */
export function isMoodleAuthenticated(): boolean {
    return state.isAuthenticated;
}

/**
 * Validate the current Moodle session cookies.
 */
export async function validateMoodleSession(): Promise<boolean> {
    return state.fetcher.validateSession();
}

/**
 * Get enrolled courses (after authentication).
 */
export function getMoodleCourses(): MoodleCourse[] {
    return [...state.courses];
}

/**
 * Clear authentication state (called on logout).
 */
export function clearMoodleAuth(): void {
    logger.debug('clearMoodleAuth called');
    state.isAuthenticated = false;
    state.courses = [];
    state.resources.clear();
    state.loadedCourses.clear();
}

/**
 * Clear all Moodle cache data for the current school.
 * Clears provider state and study-sync cache for moodle nodes.
 */
export function clearMoodleCache(): void {
    logger.info('Clearing Moodle cache for school', {
        schoolId: state.selectedSchool.id,
    });
    clearMoodleAuth();
    remoteCache.clearProvider('moodle');
    logger.info('Moodle cache cleared');
}

/**
 * Set the selected school for the provider.
 */
export function setSelectedSchool(schoolId: string): void {
    const school = getSchool(schoolId);
    if (school) {
        clearMoodleAuth();
        state.selectedSchool = school;
        state.fetcher = createFetcher(school);
        attachSessionExpiredHandler();
        resetSessionExpiredHandling('setSelectedSchool');
        logger.info('Selected school changed', {
            schoolId,
            moodleUrl: school.moodleUrl,
        });
    } else {
        logger.warn('Unknown school ID', { schoolId });
    }
}

/**
 * Force refresh resources for a specific course.
 */
export async function refreshCourseResources(
    courseId: string,
): Promise<Note[]> {
    logger.info(`Force refreshing course ${courseId}...`);

    // Mark as NOT loaded so listNotes will fetch from API
    state.loadedCourses.delete(courseId);

    // Fetch fresh data from API (listNotes will see loadedCourses doesn't have this course)
    try {
        const notes = await moodleProvider.listNodes(
            makeMoodleCourseId(courseId),
        );

        // Update disk cache too
        saveMoodleCache(
            state.courses,
            state.resources,
            state.loadedCourses,
            state.courseContextIds,
        );

        return notes as any;
    } catch (error) {
        state.loadedCourses.add(courseId);
        logger.error(
            `Failed to refresh course ${courseId}, keeping cached data`,
            { error },
        );
        throw error;
    }
}
