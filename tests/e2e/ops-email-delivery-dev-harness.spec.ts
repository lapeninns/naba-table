import { expect, test } from '@playwright/test';

const appBaseUrl = 'http://localhost:5180';

test.describe('ops email delivery dev harness', () => {
  test.use({ baseURL: appBaseUrl });

  test('shows KPIs and filters attempts by current status', async ({ page }) => {
    await page.goto('/dev/ops-email-delivery');

    await expect(page.getByRole('heading', { name: 'Email Delivery' })).toBeVisible();
    await expect(page.getByText('Deliverability', { exact: true })).toBeVisible();
    await expect(page.getByTestId('email-metric-total')).toHaveText(/^\d+$/);

    // Filter to failures (attempt-level current status).
    await page.getByRole('button', { name: /^status/i }).click();
    await page.getByRole('menuitemcheckbox', { name: /failed/i }).click();

    await expect(page.getByTestId('email-metric-total')).toHaveText('1');
    await expect(page.getByText(/mailbox unavailable/i)).toBeVisible();
  });
});
