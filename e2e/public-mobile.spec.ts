import { expect, test } from '@playwright/test';
import { assertHealthyPage, gotoAndAssert, trackAppFailures } from './helpers';

test.describe('public mobile layout smoke', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('homepage quick stats and pricing stay usable without horizontal squeeze', async ({
    page,
  }) => {
    const tracker = trackAppFailures(page);

    await gotoAndAssert(page, '/', tracker);

    const statCards = page.getByTestId('homepage-quick-stat-card');
    await expect(statCards).toHaveCount(4);

    const firstCard = await statCards.nth(0).boundingBox();
    const secondCard = await statCards.nth(1).boundingBox();

    expect(firstCard).not.toBeNull();
    expect(secondCard).not.toBeNull();
    expect((secondCard?.y ?? 0) - (firstCard?.y ?? 0)).toBeGreaterThan(40);

    const homepageHasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth + 2;
    });
    expect(homepageHasOverflow).toBe(false);

    await gotoAndAssert(page, '/pricing', tracker);
    await expect(page.getByTestId('pricing-plan-card').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /start starter trial/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /start pro trial/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /start premium trial/i })).toBeVisible();

    const pricingHasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth + 2;
    });
    expect(pricingHasOverflow).toBe(false);

    tracker.dispose();
  });
});
