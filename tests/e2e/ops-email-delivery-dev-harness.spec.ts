import { expect, test } from '@playwright/test';

const appBaseUrl = 'http://localhost:3000';
test.describe('ops email delivery dev harness', () => {
  test.use({ baseURL: appBaseUrl });

  test('renders the full tabbed email delivery UI and supports cross-area interactions', async ({ page }) => {
    await page.goto('/dev/ops-email-delivery');

    await expect(page.getByRole('heading', { name: 'Email Delivery' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Delivery Log' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Queue' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Analytics' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Go to bookings' })).toHaveAttribute('href', '/app/bookings');

    const firstDataRow = page.getByRole('row').nth(1);
    await firstDataRow.click();

    await expect(page.getByText('Event Timeline')).toBeVisible();
    await expect(page.getByRole('button', { name: /copy message id/i })).toBeVisible();
    await page.getByRole('tab', { name: 'Queue' }).click();
    await expect(page.getByText('Scheduled email queue')).toBeVisible();

    await page.getByRole('tab', { name: 'Analytics' }).click();
    await expect(page.getByText('Delivery analytics')).toBeVisible();
  });
});
