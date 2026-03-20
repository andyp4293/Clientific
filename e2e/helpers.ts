import { expect, type Locator, type Page } from '@playwright/test';

const DEFAULT_BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000';

const FATAL_TEXT_PATTERNS = [
  /Oops! Something went wrong/i,
  /This page could not be found/i,
  /Dashboard temporarily unavailable/i,
  /We'?re experiencing technical difficulties/i,
  /Application error:/i,
];

function isSameOrigin(urlString: string, baseURL: string) {
  try {
    return new URL(urlString).origin === new URL(baseURL).origin;
  } catch {
    return false;
  }
}

function ignoreUrl(urlString: string) {
  try {
    const url = new URL(urlString);
    return (
      url.pathname === '/favicon.ico' ||
      url.pathname.startsWith('/_next/static/') ||
      url.pathname.startsWith('/_next/webpack-hmr')
    );
  } catch {
    return false;
  }
}

export interface FailureTracker {
  failures: string[];
  dispose: () => void;
}

export function trackAppFailures(page: Page, baseURL = DEFAULT_BASE_URL): FailureTracker {
  const failures: string[] = [];

  const onPageError = (error: Error) => {
    failures.push(`Uncaught page error: ${error.message}`);
  };

  const onRequestFailed = (request: Parameters<Page['on']>[1] extends never ? never : any) => {
    const url = request.url();
    if (!isSameOrigin(url, baseURL) || ignoreUrl(url)) {
      return;
    }

    const resourceType = request.resourceType();
    if (!['document', 'fetch', 'xhr', 'script'].includes(resourceType)) {
      return;
    }

    const errorText = request.failure()?.errorText ?? 'unknown error';
    if (errorText.includes('ERR_ABORTED')) {
      return;
    }

    failures.push(
      `Request failed: ${request.method()} ${new URL(url).pathname} (${errorText})`
    );
  };

  const onResponse = (response: Parameters<Page['on']>[1] extends never ? never : any) => {
    const url = response.url();
    if (!isSameOrigin(url, baseURL) || ignoreUrl(url)) {
      return;
    }

    const status = response.status();
    const pathname = new URL(url).pathname;
    const resourceType = response.request().resourceType();
    const relevant = resourceType === 'document' || pathname.startsWith('/api/');

    if (relevant && status >= 400) {
      failures.push(`HTTP ${status}: ${pathname}`);
    }
  };

  page.on('pageerror', onPageError);
  page.on('requestfailed', onRequestFailed);
  page.on('response', onResponse);

  return {
    failures,
    dispose: () => {
      page.off('pageerror', onPageError);
      page.off('requestfailed', onRequestFailed);
      page.off('response', onResponse);
    },
  };
}

export async function assertHealthyPage(page: Page, tracker: FailureTracker) {
  await page.waitForLoadState('domcontentloaded');

  const body = page.locator('body');

  for (const pattern of FATAL_TEXT_PATTERNS) {
    await expect(body).not.toContainText(pattern);
  }

  const uniqueFailures = [...new Set(tracker.failures)];
  expect(uniqueFailures).toEqual([]);
}

export async function gotoAndAssert(page: Page, path: string, tracker: FailureTracker) {
  const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
  expect(response?.status(), `Document load failed for ${path}`).toBeLessThan(400);
  await assertHealthyPage(page, tracker);
}

export async function clickAndAssert(
  page: Page,
  locator: Locator,
  urlPattern: RegExp,
  tracker: FailureTracker
) {
  await expect(locator).toBeVisible();
  await locator.click();
  await page.waitForURL(urlPattern);
  await assertHealthyPage(page, tracker);
}

export async function login(page: Page, email: string, password: string, tracker: FailureTracker) {
  await gotoAndAssert(page, '/login', tracker);
  await page.getByLabel('Email Address').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log In' }).click();
  await page.waitForURL(/\/dashboard(\/|$)/);
  await assertHealthyPage(page, tracker);
}
