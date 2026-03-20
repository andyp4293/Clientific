import { expect, test } from '@playwright/test';
import { TRIAL_ACCOUNT } from './global-setup';
import { assertHealthyPage, gotoAndAssert, login, trackAppFailures } from './helpers';

test.describe('dashboard mobile layout', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('dashboard home keeps trial messaging and stat cards comfortable on mobile', async ({
    page,
  }) => {
    const tracker = trackAppFailures(page);

    await login(page, TRIAL_ACCOUNT.email, TRIAL_ACCOUNT.password, tracker);
    await gotoAndAssert(page, '/dashboard', tracker);

    await expect(page.getByTestId('layout-subscription-banner')).toHaveCount(0);
    await expect(page.getByTestId('dashboard-trial-banner')).toBeVisible();

    const bannerHeading = page.getByTestId('dashboard-trial-banner').getByText(/days left in your free trial|trial expires in/i);
    const bannerButton = page.getByRole('link', { name: /choose a plan/i });

    const bannerHeadingBox = await bannerHeading.boundingBox();
    const bannerButtonBox = await bannerButton.boundingBox();

    expect(bannerHeadingBox).not.toBeNull();
    expect(bannerButtonBox).not.toBeNull();
    expect((bannerButtonBox?.y ?? 0) - (bannerHeadingBox?.y ?? 0)).toBeGreaterThan(32);

    const statCards = page.getByTestId('dashboard-stat-card');
    await expect(statCards).toHaveCount(4);

    const firstCard = await statCards.nth(0).boundingBox();
    const secondCard = await statCards.nth(1).boundingBox();

    expect(firstCard).not.toBeNull();
    expect(secondCard).not.toBeNull();
    expect((secondCard?.y ?? 0) - (firstCard?.y ?? 0)).toBeGreaterThan(40);

    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth + 2;
    });

    expect(hasOverflow).toBe(false);
    await assertHealthyPage(page, tracker);

    tracker.dispose();
  });
});
