import { expect, test } from '@playwright/test';
import { assertHealthyPage, gotoAndAssert, trackAppFailures } from './helpers';

test.describe('public click-through smoke', () => {
  test('primary public pages load without fatal errors', async ({ page }) => {
    const tracker = trackAppFailures(page);

    await gotoAndAssert(page, '/', tracker);
    await gotoAndAssert(page, '/pricing', tracker);
    await gotoAndAssert(page, '/explore', tracker);
    await gotoAndAssert(page, '/partner', tracker);
    await gotoAndAssert(page, '/login', tracker);
    await gotoAndAssert(page, '/register', tracker);

    tracker.dispose();
  });

  test('homepage and pricing CTAs route into registration', async ({ page }) => {
    const tracker = trackAppFailures(page);

    await gotoAndAssert(page, '/', tracker);
    await page.getByRole('link', { name: 'Set up my business' }).click();
    await expect(page).toHaveURL(/\/register$/);
    await assertHealthyPage(page, tracker);

    await gotoAndAssert(page, '/pricing', tracker);
    await page.getByRole('button', { name: /^Start Starter trial$/i }).click();
    await expect(page).toHaveURL(/\/register\?plan=starter$/);
    await assertHealthyPage(page, tracker);

    tracker.dispose();
  });
});
