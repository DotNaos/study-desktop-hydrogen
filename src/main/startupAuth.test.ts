import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
    loginWithPuppeteerMock,
    setMoodleCookiesMock,
    setSelectedSchoolMock,
    storeDeleteMock,
    storeGetMock,
    storeSetMock,
} = vi.hoisted(() => ({
    loginWithPuppeteerMock: vi.fn(),
    setMoodleCookiesMock: vi.fn(),
    setSelectedSchoolMock: vi.fn(),
    storeDeleteMock: vi.fn(),
    storeGetMock: vi.fn(),
    storeSetMock: vi.fn(),
}));

vi.mock('../cli/login', () => ({
    loginWithPuppeteer: loginWithPuppeteerMock,
}));

vi.mock('./moodle', () => ({
    isMoodleAuthenticated: vi.fn(),
    onMoodleCookiesChanged: vi.fn(),
    restoreMoodleSession: vi.fn(),
    setMoodleCookies: setMoodleCookiesMock,
    setSelectedSchool: setSelectedSchoolMock,
}));

vi.mock('./config', () => ({
    store: {
        delete: storeDeleteMock,
        get: storeGetMock,
        set: storeSetMock,
    },
}));

vi.mock('./schools', () => ({
    getDefaultSchool: () => ({ id: 'fhgr' }),
    getSchool: (id: string) =>
        id === 'fhgr' || id === 'phgr' ? { id } : undefined,
}));

import {
    authenticateMoodleCredentials,
    createCredentialsHash,
} from './startupAuth';

describe('startupAuth', () => {
    const originalElectron = process.versions.electron;

    beforeEach(() => {
        vi.clearAllMocks();
        storeGetMock.mockReturnValue(undefined);
    });

    afterEach(() => {
        if (originalElectron === undefined) {
            delete (process.versions as NodeJS.ProcessVersions & { electron?: string }).electron;
        } else {
            (process.versions as NodeJS.ProcessVersions & { electron?: string }).electron =
                originalElectron;
        }
    });

    it('creates deterministic credential hashes', () => {
        const hashA = createCredentialsHash('user', 'secret');
        const hashB = createCredentialsHash('user', 'secret');
        const hashC = createCredentialsHash('user', 'different');

        expect(hashA).toBe(hashB);
        expect(hashA).not.toBe(hashC);
        expect(hashA.length).toBe(64);
    });

    it('retries interactive login in electron after headless failure', async () => {
        (process.versions as NodeJS.ProcessVersions & { electron?: string }).electron =
            '39.2.4';
        loginWithPuppeteerMock
            .mockRejectedValueOnce(new Error('Login timed out before session cookies were set.'))
            .mockResolvedValueOnce({
                cookies: 'MoodleSession=abc',
                schoolId: 'fhgr',
            });

        const result = await authenticateMoodleCredentials({
            username: 'alice',
            password: 'secret',
            schoolId: 'fhgr',
        });

        expect(result.schoolId).toBe('fhgr');
        expect(loginWithPuppeteerMock).toHaveBeenNthCalledWith(1, {
            schoolId: 'fhgr',
            username: 'alice',
            password: 'secret',
            headless: true,
            timeoutMs: 120_000,
        });
        expect(loginWithPuppeteerMock).toHaveBeenNthCalledWith(2, {
            schoolId: 'fhgr',
            username: 'alice',
            password: 'secret',
            headless: false,
            timeoutMs: 180_000,
        });
        expect(setMoodleCookiesMock).toHaveBeenCalledWith(
            'MoodleSession=abc',
            'fhgr',
        );
    });

    it('does not retry interactive login for invalid credentials', async () => {
        (process.versions as NodeJS.ProcessVersions & { electron?: string }).electron =
            '39.2.4';
        loginWithPuppeteerMock.mockRejectedValueOnce(
            new Error('INVALID_CREDENTIALS'),
        );

        await expect(
            authenticateMoodleCredentials({
                username: 'alice',
                password: 'secret',
                schoolId: 'fhgr',
            }),
        ).rejects.toThrow('INVALID_CREDENTIALS');

        expect(loginWithPuppeteerMock).toHaveBeenCalledTimes(1);
    });
});
