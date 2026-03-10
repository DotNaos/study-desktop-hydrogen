import puppeteer, {
    type Browser,
    type BrowserContext,
    type Page,
} from 'puppeteer-core';
import { ensureChromium } from '../main/chromium';
import { getDefaultSchool, getSchool, type SchoolConfig } from '../main/schools';

export interface PuppeteerLoginOptions {
    schoolId?: string;
    username?: string;
    password?: string;
    headless?: boolean;
    timeoutMs?: number;
}

export interface PuppeteerLoginResult {
    cookies: string;
    schoolId: string;
}

function resolveSchool(schoolId?: string): SchoolConfig {
    if (!schoolId) return getDefaultSchool();
    const school = getSchool(schoolId);
    if (!school) {
        throw new Error(`Unknown school id: ${schoolId}`);
    }
    return school;
}

async function fillField(page: Page, selector: string, value: string): Promise<boolean> {
    const field = await page.$(selector);
    if (!field) return false;

    await field.evaluate((element, nextValue) => {
        const input = element as HTMLInputElement | HTMLTextAreaElement;
        input.focus();
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.value = nextValue;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
    return true;
}

async function clickIfExists(page: Page, selector: string): Promise<boolean> {
    const button = await page.$(selector);
    if (!button) return false;
    await button.click();
    return true;
}

async function fillLoginForm(
    page: Page,
    school: SchoolConfig,
    username: string,
    password: string,
    timeoutMs: number,
): Promise<void> {
    const continueButton = await page.$(
        'button#wayf_submit_button, input#wayf_submit_button, button[name="Select"], a.btn-primary',
    );

    if (continueButton) {
        const visible = (await continueButton.boundingBox()) !== null;
        if (visible) {
            await continueButton.click();
            await page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => undefined);
        }
    }

    await page.waitForSelector(school.selectors.username, {
        visible: true,
        timeout: Math.min(timeoutMs, 20_000),
    });

    const usernameFilled = await fillField(page, school.selectors.username, username);
    if (!usernameFilled) {
        throw new Error('Could not locate username field on login page.');
    }

    let passwordFilled = await fillField(page, school.selectors.password, password);
    await clickIfExists(page, school.selectors.submit);

    if (!passwordFilled) {
        const passwordVisible = await page
            .waitForSelector(school.selectors.password, {
                timeout: 12_000,
                visible: true,
            })
            .then(() => true)
            .catch(() => false);

        if (passwordVisible) {
            passwordFilled = await fillField(page, school.selectors.password, password);
            await clickIfExists(page, school.selectors.submit);
        }
    }

    const urlPattern = new RegExp(`^${school.moodleUrl.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}`);
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
        if (urlPattern.test(page.url())) {
            break;
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
    }

    await page.waitForNetworkIdle({ idleTime: 300, timeout: 15_000 }).catch(() => undefined);
}

async function waitForSessionCookie(
    page: Page,
    school: SchoolConfig,
    timeoutMs: number,
): Promise<string> {
    const endTime = Date.now() + timeoutMs;

    while (Date.now() < endTime) {
        const loginError = await page.evaluate(() => {
            const errorNodes = Array.from(
                document.querySelectorAll(
                    '[role="alert"], .alert, .error, .alert-danger, .message',
                ),
            );

            return errorNodes
                .map((node) => node.textContent?.trim() || '')
                .find((text) =>
                    /incorrect|invalid|ungültig|falsch|fehler/i.test(text),
                ) || null;
        }).catch(() => null);

        if (loginError) {
            throw new Error('INVALID_CREDENTIALS');
        }

        const cookies = await page.cookies(school.moodleUrl);
        const hasSession = cookies.some((cookie) => {
            const name = cookie.name.toLowerCase();
            return name.includes('moodlesession') && !name.includes('test');
        });

        if (hasSession) {
            return cookies
                .map((cookie) => `${cookie.name}=${cookie.value}`)
                .join('; ');
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    throw new Error('Login timed out before session cookies were set.');
}

export async function loginWithPuppeteer(
    options: PuppeteerLoginOptions,
): Promise<PuppeteerLoginResult> {
    const school = resolveSchool(options.schoolId);
    const timeoutMs = options.timeoutMs ?? 120_000;
    const headless = options.headless ?? false;
    const username = options.username;
    const password = options.password;

    if (headless && (!username || !password)) {
        throw new Error('Headless login requires username and password.');
    }

    let browser: Browser | null = null;

    try {
        const executablePath = await ensureChromium();

        browser = await puppeteer.launch({
            executablePath,
            headless: headless ? true : false,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-gpu',
                '--disable-dev-shm-usage',
            ],
        });

        const context: BrowserContext = await browser.createBrowserContext();
        const page: Page = await context.newPage();

        await page.goto(school.loginUrl, {
            waitUntil: 'domcontentloaded',
            timeout: timeoutMs,
        });

        if (username && password) {
            await fillLoginForm(page, school, username, password, timeoutMs);
        }

        const cookies = await waitForSessionCookie(page, school, timeoutMs);

        await context.close().catch(() => undefined);

        return { cookies, schoolId: school.id };
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// Backwards-compatible aliases for existing call sites.
export type PlaywrightLoginOptions = PuppeteerLoginOptions;
export type PlaywrightLoginResult = PuppeteerLoginResult;
export const loginWithPlaywright = loginWithPuppeteer;
