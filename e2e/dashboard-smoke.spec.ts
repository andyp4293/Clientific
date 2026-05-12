import { test, expect } from '@playwright/test';
import { DASHBOARD_NAV_ITEMS } from '../src/lib/navigation';
import { ACTIVE_ACCOUNT, EXPIRED_ACCOUNT } from './global-setup';
import { assertHealthyPage, gotoAndAssert, login, trackAppFailures } from './helpers';

test.describe('dashboard click-through smoke', () => {
  test('dashboard pages load without 404s or fatal app errors', async ({ page }) => {
    const tracker = trackAppFailures(page);
    await login(page, ACTIVE_ACCOUNT.email, ACTIVE_ACCOUNT.password, tracker);

    for (const item of DASHBOARD_NAV_ITEMS) {
      await gotoAndAssert(page, item.href, tracker);
    }

    tracker.dispose();
  });

  test('key dashboard action buttons stay functional', async ({ page }) => {
    const tracker = trackAppFailures(page);
    await login(page, ACTIVE_ACCOUNT.email, ACTIVE_ACCOUNT.password, tracker);

    await gotoAndAssert(page, '/dashboard/appointments', tracker);
    await page.getByRole('button', { name: /New Appointment/i }).first().click();
    await expect(page.getByRole('heading', { name: 'New Appointment' })).toBeVisible();
    await assertHealthyPage(page, tracker);
    await page.reload({ waitUntil: 'domcontentloaded' });

    await gotoAndAssert(page, '/dashboard/customers', tracker);
    await page.getByRole('button', { name: /Add Customer/i }).first().click();
    await expect(page.getByRole('heading', { name: /^Add customer$/i })).toBeVisible();
    await page.getByLabel('Close add customer modal').click();
    await assertHealthyPage(page, tracker);

    await gotoAndAssert(page, '/dashboard/deals', tracker);
    await page.getByRole('button', { name: 'New Deal' }).click();
    await expect(page.getByRole('button', { name: 'Close', exact: true })).toBeVisible();
    await assertHealthyPage(page, tracker);

    await gotoAndAssert(page, '/dashboard/services', tracker);
    await page.getByRole('button', { name: 'Add Service' }).click();
    await expect(page.getByRole('heading', { name: 'Add New Service' })).toBeVisible();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await assertHealthyPage(page, tracker);

    await page.getByRole('button', { name: 'Staff' }).click();
    await page.getByRole('button', { name: 'Add Staff Member' }).click();
    await expect(page.getByRole('heading', { name: 'Add New Staff Member' })).toBeVisible();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await assertHealthyPage(page, tracker);

    await gotoAndAssert(page, '/dashboard/payouts/setup', tracker);
    await page.route('**/api/stripe/connect/onboarding-link', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          url: `${page.url().split('/dashboard')[0]}/dashboard/payouts/setup?stripe_onboarding=return&mock_onboarding=1`,
        }),
      });
    });
    await page.getByRole('button', { name: /secure setup/i }).click();
    await page.waitForURL(/mock_onboarding=1/);
    await assertHealthyPage(page, tracker);
    await page.unroute('**/api/stripe/connect/onboarding-link');

    await gotoAndAssert(page, '/dashboard/settings/billing', tracker);
    await page.route('**/api/billing/portal', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          url: `${page.url().split('/dashboard')[0]}/dashboard/settings/billing?mock_portal=1`,
        }),
      });
    });
    await page.getByRole('button', { name: 'Manage Subscription' }).click();
    await page.waitForURL(/mock_portal=1/);
    await assertHealthyPage(page, tracker);
    await page.unroute('**/api/billing/portal');

    tracker.dispose();
  });

  test('expired-trial subscription CTA starts checkout without crashing', async ({ page }) => {
    const tracker = trackAppFailures(page);
    await login(page, EXPIRED_ACCOUNT.email, EXPIRED_ACCOUNT.password, tracker);

    await gotoAndAssert(page, '/dashboard/subscribe', tracker);
    await page.route('**/api/checkout/create', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          url: `${page.url().split('/dashboard')[0]}/dashboard/subscribe?mock_checkout=1`,
        }),
      });
    });

    const checkoutButton = page.getByRole('button', { name: /^Select Starter$/i }).first();
    await checkoutButton.click();
    await page.waitForURL(/mock_checkout=1/);
    await assertHealthyPage(page, tracker);
    await page.unroute('**/api/checkout/create');

    tracker.dispose();
  });

  test('expired-trial login lands on visible subscribe content without needing a refresh', async ({ page }) => {
    const tracker = trackAppFailures(page);

    await gotoAndAssert(page, '/login', tracker);
    await page.getByLabel('Email Address').fill(EXPIRED_ACCOUNT.email);
    await page.getByLabel('Password').fill(EXPIRED_ACCOUNT.password);
    await page.getByRole('button', { name: 'Log In' }).click();

    await page.waitForURL(/\/dashboard\/subscribe$/);
    await expect(
      page.getByRole('heading', { name: /your free trial has ended|subscription required|payment failed|your subscription was canceled/i })
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /^Select Starter$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Select Pro$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Select Premium$/i })).toBeVisible();
    await assertHealthyPage(page, tracker);

    tracker.dispose();
  });
});
