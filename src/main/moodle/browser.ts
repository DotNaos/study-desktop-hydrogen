/**
 * Moodle FHGR data fetching.
 *
 * HTTP-only module for fetching courses and resources after authentication.
 * Uses JSON API for course listing, HTML parsing for course content.
 */

import { createLogger } from '@aryazos/ts-base/logging';
import { parseResources } from './parsing';
import { MoodleApiResponse, MoodleCourse, MoodleResource } from './types';
import { cleanCourseName } from './utils';

const logger = createLogger('com.aryazos.providers.moodle.browser');

// Export types for consumers
export type { MoodleCourse, MoodleResource };

/**
 * Moodle data fetcher - uses HTTP with session cookies.
 */
export class MoodleFetcher {
    private baseUrl: string;
    private cookies: string = '';
    private sesskey: string = '';
    private categoryFilter?: (category: string) => boolean;
    private sessionExpiredHandler?: (error: Error) => void;

    constructor(
        baseUrl: string,
        categoryFilter?: (category: string) => boolean,
    ) {
        this.baseUrl = baseUrl;
        this.categoryFilter = categoryFilter;
    }

    /**
     * Set cookies from Electron session for HTTP requests.
     */
    setCookies(cookies: string): void {
        this.cookies = cookies;
        this.sesskey = '';
    }

    /**
     * Register a session-expired handler for auth recovery.
     */
    setSessionExpiredHandler(handler?: (error: Error) => void): void {
        this.sessionExpiredHandler = handler;
    }

    /**
     * Check if we have valid cookies.
     */
    hasCookies(): boolean {
        return this.cookies.length > 0;
    }

    /**
     * Validate the current session by checking if we get redirected to the login page.
     * Makes a lightweight request to /my/courses.php and checks for login redirect.
     * @returns true if session is valid, false if expired/invalid
     */
    async validateSession(): Promise<boolean> {
        if (!this.hasCookies()) {
            logger.debug('validateSession: No cookies set');
            return false;
        }

        const url = `${this.baseUrl}/my/courses.php`;
        logger.debug('validateSession: Checking session validity', { url });

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    Cookie: this.cookies,
                    'User-Agent':
                        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                },
                redirect: 'manual', // Don't follow redirects, we want to detect them
            });

            const location = response.headers.get('location');
            const isRedirectToLogin =
                response.status >= 300 &&
                response.status < 400 &&
                (location?.includes('/login') ||
                    location?.includes('loginredirect'));

            logger.debug('validateSession: Response received', {
                status: response.status,
                location,
                isRedirectToLogin,
            });

            if (isRedirectToLogin) {
                logger.info(
                    'validateSession: Session expired (redirect to login)',
                );
                return false;
            }

            // 200 means we're logged in
            if (response.ok) {
                logger.info('validateSession: Session is valid');
                return true;
            }

            // Other status codes are unexpected
            logger.warn('validateSession: Unexpected status', {
                status: response.status,
            });
            return false;
        } catch (error) {
            logger.error('validateSession: Request failed', {
                error: error instanceof Error ? error.message : String(error),
            });
            return false;
        }
    }

    /**
     * Get sesskey (required for API calls).
     * Extracts it from the dashboard page if not already cached.
     */
    async getSesskey(): Promise<string> {
        if (this.sesskey) {
            logger.debug('Using cached sesskey');
            return this.sesskey;
        }

        logger.debug('Fetching sesskey from dashboard...');
        const html = await this.fetchPage('/my/');
        logger.debug('Dashboard page fetched', { htmlLength: html.length });

        const match = html.match(/"sesskey":"([^"]+)"/);
        if (match) {
            this.sesskey = match[1];
            logger.debug('Sesskey extracted (primary pattern)', {
                sesskeyLength: this.sesskey.length,
            });
        } else {
            logger.debug(
                'Primary sesskey pattern not found, trying fallback...',
            );
            // Fallback pattern
            const fallback = html.match(/sesskey=([a-zA-Z0-9]+)/);
            if (fallback) {
                this.sesskey = fallback[1];
                logger.debug('Sesskey extracted (fallback pattern)', {
                    sesskeyLength: this.sesskey.length,
                });
            }
        }

        if (!this.sesskey) {
            // Log a snippet of the HTML to help debug
            const snippet = html.substring(0, 500);
            logger.error('Could not extract sesskey from Moodle page', {
                htmlLength: html.length,
                htmlSnippet: snippet,
                containsLogin: html.includes('login'),
                containsSesskey: html.includes('sesskey'),
            });
            throw new Error('Could not extract sesskey from Moodle page');
        }

        return this.sesskey;
    }

    /**
     * Fetch a page using HTTP with session cookies.
     */
    async fetchPage(path: string): Promise<string> {
        const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
        logger.debug('Fetching page', {
            url,
            hasCookies: this.cookies.length > 0,
        });

        try {
            const response = await fetch(url, {
                headers: {
                    Cookie: this.cookies,
                    'User-Agent':
                        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                },
            });

            logger.debug('Page response received', {
                url,
                status: response.status,
                statusText: response.statusText,
                redirected: response.redirected,
                finalUrl: response.url,
            });

            if (!response.ok) {
                const body = await response.text();
                logger.error('HTTP error response', {
                    url,
                    status: response.status,
                    statusText: response.statusText,
                    bodySnippet: body.substring(0, 300),
                });
                throw new Error(
                    `HTTP ${response.status}: ${response.statusText}`,
                );
            }

            return response.text();
        } catch (error) {
            // Node.js fetch wraps network errors in a cause chain
            const cause =
                error instanceof Error && 'cause' in error
                    ? (error as any).cause
                    : undefined;
            const causeMessage =
                cause instanceof Error
                    ? cause.message
                    : cause
                      ? String(cause)
                      : undefined;
            const causeCode =
                cause && typeof cause === 'object' && 'code' in cause
                    ? (cause as any).code
                    : undefined;

            logger.error('fetchPage failed', {
                url,
                error: error instanceof Error ? error.message : String(error),
                errorType: error instanceof Error ? error.name : typeof error,
                cause: causeMessage,
                causeCode: causeCode,
                // If there's a deeper cause chain
                rootCause:
                    cause instanceof Error && 'cause' in cause
                        ? String((cause as any).cause)
                        : undefined,
            });

            // Detect redirect loop - this means cookies are invalid/expired
            if (causeMessage?.includes('redirect count exceeded')) {
                const sessionError = new Error(
                    'Moodle session expired. Please re-authenticate.',
                );
                (sessionError as any).code = 'SESSION_EXPIRED';
                this.sessionExpiredHandler?.(sessionError);
                throw sessionError;
            }

            throw error;
        }
    }

    /**
     * Fetch all enrolled courses using JSON API.
     */
    async fetchCourses(): Promise<MoodleCourse[]> {
        logger.debug('fetchCourses: Starting...');

        let sesskey: string;
        try {
            sesskey = await this.getSesskey();
            logger.debug('fetchCourses: Got sesskey', {
                sesskeyLength: sesskey.length,
            });
        } catch (error) {
            logger.error('fetchCourses: Failed to get sesskey', {
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }

        const apiUrl = `${this.baseUrl}/lib/ajax/service.php?sesskey=${sesskey}&info=core_course_get_enrolled_courses_by_timeline_classification`;
        logger.debug('fetchCourses: Calling API', { apiUrl });

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    Cookie: this.cookies,
                    'Content-Type': 'application/json',
                    'User-Agent':
                        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                body: JSON.stringify([
                    {
                        index: 0,
                        methodname:
                            'core_course_get_enrolled_courses_by_timeline_classification',
                        args: {
                            offset: 0,
                            limit: 0,
                            classification: 'all',
                            sort: 'fullname',
                            customfieldname: '',
                            customfieldvalue: '',
                            requiredfields: [
                                'id',
                                'fullname',
                                'shortname',
                                'showcoursecategory',
                                'showshortname',
                                'visible',
                                'enddate',
                            ],
                        },
                    },
                ]),
            });

            logger.debug('fetchCourses: API response received', {
                status: response.status,
                statusText: response.statusText,
                redirected: response.redirected,
                finalUrl: response.url,
            });

            if (!response.ok) {
                const body = await response.text();
                logger.error('fetchCourses: API error response', {
                    status: response.status,
                    statusText: response.statusText,
                    bodySnippet: body.substring(0, 500),
                });
                throw new Error(`API error: ${response.status}`);
            }

            const json = (await response.json()) as MoodleApiResponse[];
            logger.debug('fetchCourses: Parsed JSON response', {
                isArray: Array.isArray(json),
                length: json.length,
                firstItemError: json[0]?.error,
                firstItemException: json[0]?.exception,
                hasData: !!json[0]?.data,
                courseCount: json[0]?.data?.courses?.length,
            });

            const result = json[0];

            if (result.error || !result.data) {
                logger.error('fetchCourses: Moodle API returned error', {
                    error: result.error,
                    exception: result.exception,
                    fullResponse: JSON.stringify(result).substring(0, 500),
                });
                throw new Error(
                    `Moodle API error: ${result.exception || 'Unknown'}`,
                );
            }

            // Filter courses by category if a filter is configured
            const allCourses = result.data.courses;
            const filteredCourses = this.categoryFilter
                ? allCourses.filter((c) =>
                      this.categoryFilter!(c.coursecategory || ''),
                  )
                : allCourses;

            logger.debug('fetchCourses: Filtered courses by category', {
                totalFromApi: allCourses.length,
                afterFilter: filteredCourses.length,
                filtered: allCourses.length - filteredCourses.length,
                hasFilter: !!this.categoryFilter,
            });

            const courses = filteredCourses.map((c) => ({
                id: c.id,
                fullname: cleanCourseName(c.fullname),
                shortname: c.shortname,
                category: c.coursecategory || '',
                viewUrl: c.viewurl,
            }));

            logger.info('fetchCourses: Success', {
                courseCount: courses.length,
            });
            return courses;
        } catch (error) {
            logger.error('fetchCourses: Request failed', {
                error: error instanceof Error ? error.message : String(error),
                errorType: error instanceof Error ? error.name : typeof error,
                stack: error instanceof Error ? error.stack : undefined,
            });
            throw error;
        }
    }

    /**
     * Fetch resources from a course by parsing HTML.
     * Also extracts the contextId for batch download support.
     */
    async fetchCourseResources(
        courseId: string,
    ): Promise<{ resources: MoodleResource[]; contextId: string | null }> {
        const html = await this.fetchPage(`/course/view.php?id=${courseId}`);
        const resources = parseResources(html, courseId, this.baseUrl);

        // Extract contextId for batch download support
        let contextId: string | null = null;
        const cfgMatch = html.match(/"contextid"\s*:\s*(\d+)/);
        if (cfgMatch) {
            contextId = cfgMatch[1];
        } else {
            const linkMatch = html.match(
                /downloadcontent\.php\?contextid=(\d+)/,
            );
            if (linkMatch) {
                contextId = linkMatch[1];
            }
        }

        return { resources, contextId };
    }

    /**
     * Fetch contents of a Moodle folder.
     * Folders have their own page with files listed inside.
     */
    async fetchFolderContents(
        folderUrl: string,
        folderId: string,
    ): Promise<{ id: string; name: string; url: string }[]> {
        const html = await this.fetchPage(folderUrl);
        const files: { id: string; name: string; url: string }[] = [];

        // Match pluginfile.php download links
        // Example: href="https://moodle.phgr.ch/pluginfile.php/208387/mod_folder/content/0/file.pdf?forcedownload=1"
        // We look for any link containing pluginfile.php and mod_folder/content
        // We extract the filename from the URL itself as the link text might contain HTML (icons)
        const fileRegex =
            /href="([^"]*pluginfile\.php[^"]*\/mod_folder\/content\/[^"]*)"/g;
        let match;

        while ((match = fileRegex.exec(html)) !== null) {
            const url = match[1];
            // Extract filename from URL
            const urlObj = new URL(
                url.startsWith('http') ? url : `http://dummy${url}`,
            );
            const pathname = urlObj.pathname;
            const parts = pathname.split('/');

            let filename = decodeURIComponent(parts.at(-1) || '');

            // Try to extract full relative path to support subfolders and avoid duplicates
            // URL pattern: .../mod_folder/content/[revision]/[path/to/file]
            const contentIndex = parts.indexOf('content');
            if (contentIndex !== -1 && parts.length > contentIndex + 2) {
                const pathParts = parts.slice(contentIndex + 2);
                filename = pathParts
                    .map((p) => decodeURIComponent(p))
                    .join('/');
            }

            // Skip empty filenames
            if (!filename) continue;

            // Deduplicate by filename (which includes path)
            if (files.some((f) => f.name === filename)) continue;

            // Create unique ID from folder ID and filename
            const fileId = `${folderId}-file-${Buffer.from(filename).toString('base64').replaceAll(/[/+=]/g, '')}`;

            files.push({
                id: fileId,
                name: filename,
                url: url,
            });
        }

        logger.info('Fetched folder contents', {
            folderId,
            fileCount: files.length,
        });
        return files;
    }

    /**
     * Download a resource file to the specified path.
     */
    async downloadFile(resourceUrl: string, destPath: string): Promise<void> {
        const { buffer } = await this.downloadFileToBuffer(resourceUrl);
        const fs = await import('node:fs/promises');
        await fs.writeFile(destPath, buffer);
    }

    /**
     * Download a resource file and return as Buffer with metadata.
     */
    async downloadFileToBuffer(resourceUrl: string): Promise<{
        buffer: Buffer;
        contentType: string;
        filename?: string;
    }> {
        const response = await fetch(resourceUrl, {
            headers: {
                Cookie: this.cookies,
                'User-Agent':
                    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            },
            redirect: 'follow',
        });

        if (!response.ok) {
            throw new Error(`Failed to download: ${response.status}`);
        }

        const contentType =
            response.headers.get('content-type') || 'application/octet-stream';

        // Extract filename from Content-Disposition header if available
        const contentDisposition = response.headers.get('content-disposition');
        let filename: string | undefined;
        if (contentDisposition) {
            const filenameMatch = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(
                contentDisposition,
            );
            if (filenameMatch) {
                filename = filenameMatch[1].replaceAll(/['"]/g, '');
            }
        }

        const arrayBuffer = await response.arrayBuffer();
        return {
            buffer: Buffer.from(arrayBuffer),
            contentType,
            filename,
        };
    }
}
