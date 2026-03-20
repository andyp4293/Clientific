import { expect, test } from '@playwright/test';
import { TRIAL_ACCOUNT } from './global-setup';
import { assertHealthyPage, gotoAndAssert, login, trackAppFailures } from './helpers';

test.describe('customers mobile layout', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('customers page shows readable cards with key details on mobile', async ({
    page,
  }) => {
    const tracker = trackAppFailures(page);

    await login(page, TRIAL_ACCOUNT.email, TRIAL_ACCOUNT.password, tracker);
    await gotoAndAssert(page, '/dashboard/customers', tracker);

    const mobileList = page.getByTestId('customer-mobile-list');
    await expect(mobileList).toBeVisible();
    await expect(mobileList.getByText('Ariana Perez')).toBeVisible();
    await expect(mobileList.getByText('Nina Brooks')).toBeVisible();
    await expect(mobileList.getByText(/customer type helps you quickly spot/i)).toHaveCount(0);

    const cards = mobileList.locator('article');
    await expect(cards).toHaveCount(2);

    const firstCard = await cards.nth(0).boundingBox();
    const secondCard = await cards.nth(1).boundingBox();

    expect(firstCard).not.toBeNull();
    expect(secondCard).not.toBeNull();
    expect((secondCard?.y ?? 0) - (firstCard?.y ?? 0)).toBeGreaterThan(140);

    await expect(mobileList.getByText('Customer type').first()).toBeVisible();
    await expect(mobileList.getByText('SMS status').first()).toBeVisible();
    await expect(mobileList.getByText('Total spent').first()).toBeVisible();
    await expect(mobileList.getByRole('link', { name: 'View' }).first()).toBeVisible();

    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth + 2;
    });

    expect(hasOverflow).toBe(false);
    await assertHealthyPage(page, tracker);
    tracker.dispose();
  });
});
