import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { ACTIVE_ACCOUNT } from './global-setup';
import { assertHealthyPage, gotoAndAssert, trackAppFailures } from './helpers';

const artifactsDir = join(process.cwd(), 'test-artifacts', 'referrals');

test.describe('referral creator flow', () => {
  test.beforeAll(() => {
    mkdirSync(artifactsDir, { recursive: true });
  });

  test('public creator onboarding explains the referral program clearly', async ({ page }) => {
    const tracker = trackAppFailures(page);

    await gotoAndAssert(page, '/partner', tracker);

    await expect(
      page.getByRole('heading', {
        name: /earn 30% every month a referred business pays/i,
      })
    ).toBeVisible();
    await expect(page.getByText(/create a free clientific partner account/i).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /finish payout setup/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /share your referral link/i })).toBeVisible();

    await page.screenshot({
      path: join(artifactsDir, 'web-partner-creator-onboarding.png'),
      fullPage: true,
    });

    await page.getByRole('link', { name: /create free referral account/i }).first().click();
    await expect(page).toHaveURL(/\/register\?partner=1$/);
    await expect(
      page.getByText(/create a free referral partner account, finish payout setup/i)
    ).toBeVisible();
    await assertHealthyPage(page, tracker);

    tracker.dispose();
  });

  test('signup from a referral link carries the normalized referral code into registration', async ({
    page,
  }) => {
    const tracker = trackAppFailures(page);
    let registerPayload: Record<string, unknown> | null = null;

    await page.route('**/api/auth/check-email', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ available: true }),
      });
    });
    await page.route('**/api/auth/register', async (route) => {
      registerPayload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, verificationEmailSent: true }),
      });
    });

    await gotoAndAssert(page, '/register?ref=abcd1234', tracker);
    await expect(page.getByTestId('register-referral-applied')).toBeVisible();

    await page.getByLabel(/account email/i).fill('creator-referred-owner@example.com');
    await page.getByLabel(/^password \*/i).fill('Password123!');
    await page.getByLabel(/confirm password/i).fill('Password123!');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: /^next$/i }).click();
    await expect(page.getByRole('heading', { name: /tell us about your business/i })).toBeVisible();
    await page.getByLabel(/business name/i).fill('Creator Referred Studio');

    await page.screenshot({
      path: join(artifactsDir, 'web-register-referral-applied.png'),
      fullPage: true,
    });

    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page.getByRole('heading', { name: /check your email/i })).toBeVisible();
    await expect.poll(() => registerPayload?.referralCode).toBe('ABCD1234');
    await assertHealthyPage(page, tracker);

    tracker.dispose();
  });

  test('dashboard referral page exposes direct links and the creator promo kit', async ({ page }) => {
    const tracker = trackAppFailures(page);

    await gotoAndAssert(page, '/login', tracker);
    await page.getByLabel('Email Address').fill(ACTIVE_ACCOUNT.email);
    await page.getByLabel('Password').fill(ACTIVE_ACCOUNT.password);
    await page.getByRole('button', { name: 'Log In' }).click();
    await expect(page.getByRole('heading', { name: /^Dashboard$/ })).toBeVisible();
    await assertHealthyPage(page, tracker);

    await page.route('**/api/referrals', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          referralCode: 'E2ECODE1',
          totalCredits: 42,
          referrals: [
            {
              id: 'ref-e2e-1',
              createdAt: '2026-05-01T00:00:00.000Z',
              status: 'credited',
              creditAmount: 42,
              creditedAt: '2026-05-15T00:00:00.000Z',
              referee: {
                name: 'Creator Referred Studio',
                createdAt: '2026-05-01T00:00:00.000Z',
              },
            },
          ],
          payoutReady: true,
          payoutStatusCode: 'ready',
          payoutSetupMessage: null,
        }),
      });
    });

    await gotoAndAssert(page, '/dashboard/referrals', tracker);

    await expect(page.locator('input[value*="ref=E2ECODE1"]')).toBeVisible();
    await expect(page.getByTestId('creator-referral-kit')).toContainText(
      'Send this to creators'
    );
    await expect(page.getByTestId('creator-referral-brief')).toContainText('/partner');
    await expect(page.getByTestId('creator-referral-brief')).toContainText(
      'use your own referral link'
    );
    await expect(page.getByText('Creator Referred Studio')).toBeVisible();

    await page.screenshot({
      path: join(artifactsDir, 'web-dashboard-referrals-creator-kit.png'),
      fullPage: true,
    });
    await assertHealthyPage(page, tracker);

    tracker.dispose();
  });
});
