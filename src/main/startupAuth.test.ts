import { describe, expect, it } from 'vitest';
import { createCredentialsHash } from './startupAuth';

describe('startupAuth', () => {
    it('creates deterministic credential hashes', () => {
        const hashA = createCredentialsHash('user', 'secret');
        const hashB = createCredentialsHash('user', 'secret');
        const hashC = createCredentialsHash('user', 'different');

        expect(hashA).toBe(hashB);
        expect(hashA).not.toBe(hashC);
        expect(hashA.length).toBe(64);
    });
});

