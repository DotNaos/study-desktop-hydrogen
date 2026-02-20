import {
    Browser,
    BrowserPlatform,
    detectBrowserPlatform,
    install,
    resolveBuildId,
} from '@puppeteer/browsers';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cacheDir = path.join(__dirname, '..', '.chromium');

const platformArg = process.argv[2];
const PLATFORM_MAP = {
    win64: BrowserPlatform.WIN64,
    win32: BrowserPlatform.WIN32,
    mac: BrowserPlatform.MAC,
    mac_arm: BrowserPlatform.MAC_ARM,
    linux: BrowserPlatform.LINUX,
};

const platform =
    platformArg && PLATFORM_MAP[platformArg]
        ? PLATFORM_MAP[platformArg]
        : detectBrowserPlatform();

if (!platform) {
    console.error('Could not detect Chromium platform.');
    process.exit(1);
}

console.log('Downloading Chrome for Testing:', { platform, cacheDir });

try {
    const buildId = await resolveBuildId(Browser.CHROME, platform, 'stable');
    const result = await install({
        browser: Browser.CHROME,
        buildId,
        cacheDir,
        platform,
    });

    console.log('Chrome installed:', result.executablePath);
} catch (error) {
    console.error('Failed to download Chrome for Testing:', error);
    process.exit(1);
}
