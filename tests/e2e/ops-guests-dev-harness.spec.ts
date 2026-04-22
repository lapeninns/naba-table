import { expect, test, type Page } from '@playwright/test';

const appBaseUrl = 'http://localhost:5180';

async function openGuestsHarness(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'domcontentloaded' });

  const totalMetric = page.getByTestId('guest-metric-total');
  await expect
    .poll(async () => (await totalMetric.textContent())?.trim() ?? '', {
      timeout: 60_000,
    })
    .toMatch(/^\d+$/);
}

test.describe('ops guests dev harness', () => {
  test.use({ baseURL: appBaseUrl });

  test('shows guests KPIs and updates with search', async ({ page }) => {
    await openGuestsHarness(page, '/dev/ops-customers');

    await expect(page.getByRole('heading', { name: 'Guests' })).toBeVisible();
    await expect(page.getByText('Guest metrics')).toBeVisible();

    const search = page.getByRole('searchbox', { name: /search guests/i });
    await search.fill('Sam');

    await expect(page.getByTestId('guest-metric-total')).toHaveText('1');
    await expect(page.getByText('Sam Patel')).toBeVisible();
  });

  test('deep-link focus focuses the matching guest card', async ({ page }) => {
    await openGuestsHarness(page, '/dev/ops-customers?focus=cust-2');

    const target = page.locator('[data-customer-id="cust-2"]');
    await expect(target).toBeVisible({ timeout: 60_000 });
    await expect(target).toBeFocused();
  });
});
