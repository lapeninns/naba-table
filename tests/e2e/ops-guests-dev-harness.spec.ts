import { expect, test } from '@playwright/test';

const appBaseUrl = 'http://localhost:5180';

test.describe('ops guests dev harness', () => {
  test.use({ baseURL: appBaseUrl });

  test('shows guests KPIs and updates with search', async ({ page }) => {
    await page.goto('/dev/ops-customers');

    await expect(page.getByRole('heading', { name: 'Guests' })).toBeVisible();
    await expect(page.getByText('Guest metrics')).toBeVisible();

    // Default mock dataset should have a stable total.
    await expect(page.getByTestId('guest-metric-total')).toHaveText(/^\d+$/);

    const search = page.getByRole('searchbox', { name: /search guests/i });
    await search.fill('Sam');

    await expect(page.getByTestId('guest-metric-total')).toHaveText('1');
    await expect(page.getByText('Sam Patel')).toBeVisible();
  });

  test('deep-link focus focuses the matching guest card', async ({ page }) => {
    await page.goto('/dev/ops-customers?focus=cust-2');

    const target = page.locator('[data-customer-id="cust-2"]');
    await expect(target).toBeVisible();
    await expect(target).toBeFocused();
  });
});
