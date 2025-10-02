import { expect, test } from '@playwright/test';

const flagValue = process.env.NEXT_PUBLIC_RESERVE_V2;

const shouldRun = flagValue === 'false';

test.describe('reserve legacy flow', () => {
  test.skip(!shouldRun, 'Set NEXT_PUBLIC_RESERVE_V2=false to validate legacy experience.');

  test('renders legacy booking form when V2 disabled', async ({ page, baseURL }) => {
    test.skip(!baseURL, 'Base URL must be configured.');

    await page.goto('/reserve');
    await expect(page.getByRole('heading', { name: /Book your table/i })).toBeVisible();
  });
});
