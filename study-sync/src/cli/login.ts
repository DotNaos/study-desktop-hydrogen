import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { getDefaultSchool, getSchool, type SchoolConfig } from "../main/schools";

export interface PlaywrightLoginOptions {
  schoolId?: string;
  username?: string;
  password?: string;
  headless?: boolean;
  timeoutMs?: number;
}

export interface PlaywrightLoginResult {
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

async function fillLoginForm(
  page: Page,
  school: SchoolConfig,
  username: string,
  password: string,
  timeoutMs: number,
): Promise<void> {
  const continueRegex = /continue|weiter|next|fortsetzen|proceed/i;

  const clickContinueIfNeeded = async (): Promise<boolean> => {
    const roles: Array<"button" | "link"> = ["button", "link"];
    for (const role of roles) {
      const locator = page.getByRole(role, { name: continueRegex }).first();
      if ((await locator.count()) > 0) {
        const visible = await locator.isVisible().catch(() => false);
        if (visible) {
          await locator.click();
          return true;
        }
      }
    }

    const inputs = page.locator('input[type="submit"], input[type="button"]');
    const count = await inputs.count();
    for (let i = 0; i < count; i += 1) {
      const input = inputs.nth(i);
      const value = await input.getAttribute("value");
      if (value && continueRegex.test(value)) {
        const visible = await input.isVisible().catch(() => false);
        if (visible) {
          await input.click();
          return true;
        }
      }
    }

    return false;
  };

  const usernameField = page.locator(school.selectors.username).first();
  if (await usernameField.count()) {
    const usernameVisible = await usernameField.isVisible().catch(() => false);
    if (!usernameVisible) {
      const clicked = await clickContinueIfNeeded();
      if (clicked) {
        await page.waitForSelector(school.selectors.username, {
          state: "visible",
          timeout: Math.min(timeoutMs, 10_000),
        }).catch(() => undefined);
      }
    }
    await usernameField.fill(username);
  }

  const passwordField = page.locator(school.selectors.password).first();
  const hasPasswordField = (await passwordField.count()) > 0;
  if (hasPasswordField) {
    await passwordField.fill(password);
  }

  const submitButton = page.locator(school.selectors.submit).first();
  if (await submitButton.count()) {
    await submitButton.click();
  }

  const passwordVisible = await page
    .waitForSelector(school.selectors.password, { timeout: 5000 })
    .then(() => true)
    .catch(() => false);

  if (passwordVisible && !hasPasswordField) {
    const updatedPassword = page.locator(school.selectors.password).first();
    await updatedPassword.fill(password);
    const updatedSubmit = page.locator(school.selectors.submit).first();
    if (await updatedSubmit.count()) {
      await updatedSubmit.click();
    }
  }

  await page.waitForLoadState("domcontentloaded", { timeout: timeoutMs });
}

async function waitForSessionCookie(
  context: BrowserContext,
  school: SchoolConfig,
  timeoutMs: number,
): Promise<string> {
  const endTime = Date.now() + timeoutMs;

  while (Date.now() < endTime) {
    const cookies = await context.cookies(school.moodleUrl);
    const hasSession = cookies.some((cookie) => {
      const name = cookie.name.toLowerCase();
      return name.includes("moodlesession") && !name.includes("test");
    });

    if (hasSession) {
      return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error("Login timed out before session cookies were set.");
}

export async function loginWithPlaywright(
  options: PlaywrightLoginOptions,
): Promise<PlaywrightLoginResult> {
  const school = resolveSchool(options.schoolId);
  const timeoutMs = options.timeoutMs ?? 120_000;
  const headless = options.headless ?? false;
  const username = options.username;
  const password = options.password;

  if (headless && (!username || !password)) {
    throw new Error("Headless login requires --username and --password.");
  }

  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({ headless });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(school.loginUrl, { waitUntil: "domcontentloaded" });

    if (username && password) {
      await fillLoginForm(page, school, username, password, timeoutMs);
    }

    const cookies = await waitForSessionCookie(context, school, timeoutMs);

    return { cookies, schoolId: school.id };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
