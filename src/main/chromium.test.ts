import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { getChromiumExecutablePathFromBaseDir } from './chromium';

const tempDirs: string[] = [];

function makeTempDir(): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'study-chromium-test-'));
    tempDirs.push(dir);
    return dir;
}

function createMacBinary(baseDir: string, version: string): string {
    const executablePath = path.join(
        baseDir,
        'chrome',
        version,
        'chrome-mac-arm64',
        'Google Chrome for Testing.app',
        'Contents',
        'MacOS',
        'Google Chrome for Testing',
    );
    mkdirSync(path.dirname(executablePath), { recursive: true });
    writeFileSync(executablePath, 'binary');
    return executablePath;
}

describe.runIf(process.platform === 'darwin' && process.arch === 'arm64')(
    'chromium path resolution',
    () => {
        afterEach(() => {
            while (tempDirs.length > 0) {
                const dir = tempDirs.pop();
                if (!dir) continue;
                try {
                    rmSync(dir, { recursive: true, force: true });
                } catch {
                    // ignore cleanup failures in tests
                }
            }
        });

        it('resolves a cached executable nested under the chrome browser directory', () => {
            const baseDir = makeTempDir();
            const executablePath = createMacBinary(
                baseDir,
                'mac_arm-145.0.7632.77',
            );

            expect(getChromiumExecutablePathFromBaseDir(baseDir)).toBe(
                executablePath,
            );
        });

        it('falls back to the newest valid executable when the latest version dir is incomplete', () => {
            const baseDir = makeTempDir();
            mkdirSync(path.join(baseDir, 'chrome', 'mac_arm-146.0.7680.72'), {
                recursive: true,
            });
            const executablePath = createMacBinary(
                baseDir,
                'mac_arm-146.0.7680.31',
            );

            expect(getChromiumExecutablePathFromBaseDir(baseDir)).toBe(
                executablePath,
            );
        });
    },
);
