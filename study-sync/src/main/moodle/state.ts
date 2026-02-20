import { getDefaultSchool, SchoolConfig, shouldIncludeCategory } from "../schools";
import { MoodleCourse, MoodleFetcher, MoodleResource } from "./browser";

export interface MoodleState {
  fetcher: MoodleFetcher;
  isAuthenticated: boolean;
  courses: MoodleCourse[];
  resources: Map<string, MoodleResource>;
  loadedCourses: Set<string>; // Track which courses have been fetched
  selectedSchool: SchoolConfig; // Currently selected school
  courseContextIds: Map<string, string>; // courseId -> contextId
  batchDownloadAttempted: Set<string>; // Track courses where batch download was tried
  // Conversion options for batch download
  conversionOptions: {
    convertToPdf: boolean;
    includeAll: boolean;
  };
}

/** Create a MoodleFetcher for a given school with its category filter */
export function createFetcher(school: SchoolConfig): MoodleFetcher {
  const categoryFilter = (category: string) => shouldIncludeCategory(category, school);
  return new MoodleFetcher(school.moodleUrl, categoryFilter);
}

export const state: MoodleState = {
  fetcher: createFetcher(getDefaultSchool()),
  isAuthenticated: false,
  courses: [],
  resources: new Map(),
  loadedCourses: new Set(),
  selectedSchool: getDefaultSchool(),
  courseContextIds: new Map(),
  batchDownloadAttempted: new Set(),
  conversionOptions: {
    convertToPdf: true,
    includeAll: false,
  },
};
