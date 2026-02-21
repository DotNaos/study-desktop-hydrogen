import express from 'express';
import { createServer, type Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
    bootstrapMoodleAuthMock,
    authenticateMoodleCredentialsMock,
    isAuthenticatedMock,
    setMoodleCookiesMock,
    storeGetMock,
} = vi.hoisted(() => ({
    bootstrapMoodleAuthMock: vi.fn(),
    authenticateMoodleCredentialsMock: vi.fn(),
    isAuthenticatedMock: vi.fn(),
    setMoodleCookiesMock: vi.fn(),
    storeGetMock: vi.fn(),
}));

vi.mock('../../startupAuth', () => ({
    bootstrapMoodleAuth: bootstrapMoodleAuthMock,
    authenticateMoodleCredentials: authenticateMoodleCredentialsMock,
}));

vi.mock('../../providers', () => ({
    primaryProvider: {
        isAuthenticated: isAuthenticatedMock,
    },
}));

vi.mock('../../moodle', () => ({
    setMoodleCookies: setMoodleCookiesMock,
}));

vi.mock('../../config', () => ({
    store: {
        get: storeGetMock,
    },
}));

import authRouter from './auth';

describe('auth routes', () => {
    let server: Server | null = null;
    let baseUrl = '';

    beforeEach(async () => {
        vi.clearAllMocks();
        const app = express();
        app.use(express.json());
        app.use('/', authRouter);

        server = createServer(app);
        await new Promise<void>((resolve) => server!.listen(0, resolve));
        const address = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}`;
    });

    afterEach(async () => {
        if (!server) {
            return;
        }
        await new Promise<void>((resolve, reject) =>
            server!.close((error) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve();
            }),
        );
        server = null;
    });

    it('returns status with selected school and stored credentials flag', async () => {
        isAuthenticatedMock.mockReturnValue(false);
        storeGetMock.mockImplementation((key: string) => {
            if (key === 'selectedSchool') {
                return 'fhgr';
            }
            if (key === 'schools.fhgr.username') {
                return 'demo-user';
            }
            if (key === 'schools.fhgr.password') {
                return 'demo-pass';
            }
            return undefined;
        });

        const response = await fetch(`${baseUrl}/status`);
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.authenticated).toBe(false);
        expect(payload.selectedSchool).toBe('fhgr');
        expect(payload.hasStoredCredentials).toBe(true);
    });

    it('logs in with posted credentials', async () => {
        isAuthenticatedMock.mockReturnValue(true);
        authenticateMoodleCredentialsMock.mockResolvedValue({
            schoolId: 'fhgr',
            credentialsHash: 'hash',
        });

        const response = await fetch(`${baseUrl}/login`, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                username: 'alice',
                password: 'secret',
                schoolId: 'fhgr',
            }),
        });

        const payload = await response.json();
        expect(response.status).toBe(200);
        expect(payload.ok).toBe(true);
        expect(payload.authenticated).toBe(true);
        expect(payload.schoolId).toBe('fhgr');
        expect(authenticateMoodleCredentialsMock).toHaveBeenCalledWith({
            username: 'alice',
            password: 'secret',
            schoolId: 'fhgr',
        });
    });

    it('returns 401 when bootstrap login fails', async () => {
        isAuthenticatedMock.mockReturnValue(false);
        bootstrapMoodleAuthMock.mockResolvedValue(false);

        const response = await fetch(`${baseUrl}/login`, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify({}),
        });

        const payload = await response.json();
        expect(response.status).toBe(401);
        expect(payload.error).toBe('LOGIN_FAILED');
    });
});
