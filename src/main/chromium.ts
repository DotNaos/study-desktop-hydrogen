import {
    Browser,
    detectBrowserPlatform,
    install,
    resolveBuildId,
} from '@puppeteer/browsers';
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { createLogger } from '@aryazos/ts-base/logging';
import { ensureStudySyncDataDir } from '../shared/paths';

const logger = createLogger('com.aryazos.study-sync.chromium');

function getPlatformPrefix(): string {
    const p = process.platform;
    const a = process.arch;

    if (p === 'darwin') {
        return a === 'arm64' ? 'mac_arm' : 'mac';
    }

    if (p === 'win32') {
        return a === 'ia32' ? 'win32' : 'win64';
    }

    return 'linux';
}

function getProjectRoot(): string {
    // out/main -> project root
    return path.resolve(__dirname, '../../..');
}

function getBundledChromiumBaseDir(): string {
    if (process.versions?.electron && process.resourcesPath) {
        return path.join(process.resourcesPath, '.chromium');
    }

    return path.join(getProjectRoot(), '.chromium');
}

function getRuntimeChromiumBaseDir(): string {
    return path.join(ensureStudySyncDataDir(), 'chromium');
}

function findVersionDir(baseDir: string, prefix: string): string | null {
    if (!existsSync(baseDir)) {
        return null;
    }

    try {
        const entries = readdirSync(baseDir);
        return entries.find((entry) => entry.startsWith(prefix)) ?? null;
    } catch {
        return null;
    }
}

function executableFromVersionDir(baseDir: string, versionDir: string): string {
    if (process.platform === 'darwin') {
        const chromeDir = process.arch === 'arm64' ? 'chrome-mac-arm64' : 'chrome-mac-x64';
        return path.join(
            baseDir,
            versionDir,
            chromeDir,
            'Google Chrome for Testing.app',
            'Contents',
            'MacOS',
            'Google Chrome for Testing',
        );
    }

    if (process.platform === 'win32') {
        const chromeDir = process.arch === 'ia32' ? 'chrome-win32' : 'chrome-win64';
        return path.join(baseDir, versionDir, chromeDir, 'chrome.exe');
    }

    return path.join(baseDir, versionDir, 'chrome-linux64', 'chrome');
}

export function getChromiumExecutablePathFromBaseDir(baseDir: string): string | null {
    const prefix = getPlatformPrefix();
    const searchDirs = [baseDir, path.join(baseDir, 'chrome')];

    for (const searchDir of searchDirs) {
        if (!existsSync(searchDir)) {
            continue;
        }

        const versionDir = findVersionDir(searchDir, prefix);
        if (!versionDir) {
            continue;
        }

        const executablePath = executableFromVersionDir(searchDir, versionDir);
        if (existsSync(executablePath)) {
            return executablePath;
        }

        try {
            const entries = readdirSync(searchDir)
                .filter((entry) => entry.startsWith(prefix))
                .sort()
                .reverse();

            for (const entry of entries) {
                const candidate = executableFromVersionDir(searchDir, entry);
                if (existsSync(candidate)) {
                    return candidate;
                }
            }
        } catch {
            // Ignore malformed cache directories and keep searching.
        }
    }

    return null;
}

export function getChromiumExecutablePath(): string | null {
    const overridePath = process.env.STUDY_SYNC_CHROMIUM_PATH;
    if (overridePath && existsSync(overridePath)) {
        return overridePath;
    }

    const bundled = getChromiumExecutablePathFromBaseDir(
        getBundledChromiumBaseDir(),
    );
    if (bundled && existsSync(bundled)) {
        return bundled;
    }

    const runtime = getChromiumExecutablePathFromBaseDir(
        getRuntimeChromiumBaseDir(),
    );
    if (runtime && existsSync(runtime)) {
        return runtime;
    }

    return null;
}

export async function ensureChromium(): Promise<string> {
    const existingPath = getChromiumExecutablePath();
    if (existingPath) {
        return existingPath;
    }

    const platform = detectBrowserPlatform();
    if (!platform) {
        throw new Error('Could not detect Chromium platform');
    }

    const buildId = await resolveBuildId(Browser.CHROME, platform, 'stable');
    const cacheDir = getRuntimeChromiumBaseDir();

    logger.info('Downloading Chrome for Testing', {
        cacheDir,
        buildId,
        platform,
    });

    const result = await install({
        browser: Browser.CHROME,
        buildId,
        cacheDir,
        platform,
    });

    logger.info('Chrome for Testing available', {
        executablePath: result.executablePath,
    });

    if (existsSync(result.executablePath)) {
        return result.executablePath;
    }

    const recoveredPath = getChromiumExecutablePathFromBaseDir(cacheDir);
    if (recoveredPath) {
        logger.warn('Resolved Chromium from cache after install returned a missing executable', {
            cacheDir,
            executablePath: result.executablePath,
            recoveredPath,
        });
        return recoveredPath;
    }

    throw new Error(
        `Chrome for Testing install completed but executable is missing: ${result.executablePath}`,
    );
}

export function getDefaultChromiumCacheDir(): string {
    if (process.versions?.electron || process.env.ELECTRON_RUN_AS_NODE) {
        return getRuntimeChromiumBaseDir();
    }

    return path.join(homedir(), '.cache', 'study-sync', 'chromium');
}
