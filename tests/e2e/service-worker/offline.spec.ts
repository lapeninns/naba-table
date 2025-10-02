import { expect, test } from '@playwright/test';

const shouldRun = process.env.PLAYWRIGHT_TEST_OFFLINE === 'true';

const reserveFlag = process.env.NEXT_PUBLIC_RESERVE_V2;

test.describe('reservation wizard offline resilience', () => {
  test.skip(reserveFlag !== 'true', 'NEXT_PUBLIC_RESERVE_V2 must be true.');
  test.skip(!shouldRun, 'Enable PLAYWRIGHT_TEST_OFFLINE=true to exercise offline UX.');

  test('shows offline notice when network drops on confirmation', async ({ context, page }) => {
    await page.goto('/reserve');
    await context.setOffline(true);
    await page.getByRole('button', { name: /Confirm reservation/i }).click();
    await expect(page.getByText(/You appear to be offline/i)).toBeVisible();
    await context.setOffline(false);
  });
});
