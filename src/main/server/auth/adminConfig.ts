/**
 * Admin access configuration.
 * Uses Authentik group membership (via X-authentik-groups header)
 * instead of hardcoded user IDs.
 */

const ADMIN_GROUP = 'admins';

/**
 * Check if a user is an admin based on their Authentik groups.
 * The groups header is a pipe-separated list (e.g. "admins|users").
 */
export function isAdminByGroups(groups: string | undefined): boolean {
    if (!groups) return false;
    const groupList = groups.split('|').map((g) => g.trim().toLowerCase());
    return groupList.includes(ADMIN_GROUP);
}
