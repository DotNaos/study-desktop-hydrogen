/**
 * Moodle Provider
 *
 * Exports the DataProvider implementation and Electron integration helpers.
 * Refactored into modular components.
 */

// Re-export types
export type { MoodleCourse, MoodleResource } from "./browser";

// Export ID helpers
export {
    makeMoodleCourseId,
    makeMoodleFileId,
    makeMoodleFolderId,
    makeMoodleResourceId,
    makeMoodleSectionId,
    parseMoodleNodeId
} from "./ids";

// Export Integration helpers (used by Main Process)
export {
    clearMoodleAuth,
    clearMoodleCache,
    clearReauthPending,
    getMoodleCourses,
    isMoodleAuthenticated,
    isReauthPending,
    onMoodleCookiesChanged,
    onMoodleSessionExpired,
    refreshCourseResources,
    restoreMoodleSession,
    setMoodleCookies, setSelectedSchool, validateMoodleSession
} from "./integration";

// Export the DataProvider
export { moodleProvider } from "./provider";
