/**
 * School Configuration Registry
 *
 * Defines supported schools and their Moodle configurations.
 * Each school has its own domain, login page, and form selectors.
 */

export interface CategoryFilter {
  /** Filter mode: whitelist only shows matching, blacklist hides matching */
  mode: "whitelist" | "blacklist";
  /** Patterns to match against category names */
  patterns: RegExp[];
}

export interface SchoolConfig {
  /** Unique identifier (e.g., "fhgr", "phgr") */
  id: string;

  /** Display name for UI */
  name: string;

  /** Base Moodle URL (e.g., "https://moodle.fhgr.ch") */
  moodleUrl: string;

  /** Login page URL */
  loginUrl: string;

  /** CSS selectors for login form automation */
  selectors: {
    username: string;
    password: string;
    submit: string;
  };

  /** Regex patterns to clean course names (remove school-specific prefixes) */
  courseNamePatterns?: RegExp[];

  /** Optional category filter - if not set, all courses are included */
  categoryFilter?: CategoryFilter;
}

/**
 * Supported schools registry.
 * Add new schools here as needed.
 */
export const SCHOOLS: SchoolConfig[] = [
  {
    id: "fhgr",
    name: "FHGR",
    moodleUrl: "https://moodle.fhgr.ch",
    loginUrl: "https://moodle.fhgr.ch/login/index.php",
    selectors: {
      username: 'input[name="username"], input[name="login"], input[type="email"], input#username, input#login',
      password: 'input[name="password"], input[type="password"], input#password',
      submit: 'button[type="submit"], input[type="submit"], button#login, button.btn-primary',
    },
    courseNamePatterns: [
      /^\d{4}\s+(FS|HS)\s+FHGR\s+(\w+\s+)?/i, // "2025 HS FHGR CDS ..."
    ],
    // FHGR uses term-based categories (FS25, HS24) - whitelist only those
    categoryFilter: {
      mode: "whitelist",
      patterns: [/^(FS|HS)\d{2}$/], // Match FS25, HS24, etc.
    },
  },
  {
    id: "phgr",
    name: "PHGR",
    moodleUrl: "https://moodle.phgr.ch",
    // Use SSO redirect URL directly - skips the Moodle login page
    loginUrl: "https://moodle.phgr.ch/Shibboleth.sso/Login?providerId=https%3A%2F%2Feduid.ch%2Fidp%2Fshibboleth&target=https%3A%2F%2Fmoodle.phgr.ch%2Fauth%2Fshibboleth%2Findex.php",
    selectors: {
      // Edu-ID uses two-step login: email first, then password
      username: 'input[type="email"], input[name="email"], input#email, input[name="j_username"], input#username',
      password: 'input[type="password"], input[name="password"], input#password, input[name="j_password"]',
      submit: 'button[type="submit"], input[type="submit"], button.btn-primary, button.btn',
    },
    courseNamePatterns: [
      /^\d{4}\s+(FS|HS)\s+PHGR\s+(\w+\s+)?/i,
    ],
    // PHGR uses subject categories - no filter, include all courses
    // categoryFilter: undefined (all courses included)
  },
];

/**
 * Get school config by ID.
 */
export function getSchool(id: string): SchoolConfig | undefined {
  return SCHOOLS.find((s) => s.id === id);
}

/**
 * Get the default school (first in list).
 */
export function getDefaultSchool(): SchoolConfig {
  return SCHOOLS[0];
}

/**
 * Check if a category should be included based on school's filter.
 * Returns true if no filter is set or if category passes the filter.
 */
export function shouldIncludeCategory(category: string, school: SchoolConfig): boolean {
  if (!school.categoryFilter) {
    return true; // No filter = include all
  }

  const { mode, patterns } = school.categoryFilter;
  const matches = patterns.some((p) => p.test(category));

  return mode === "whitelist" ? matches : !matches;
}
