import { expect, test } from '@playwright/test';

test.describe('reservation wizard', () => {
  test('blocks progression until required fields are provided', async ({ page }) => {
    const baseURL = test.info().project.use?.baseURL;
    test.skip(!baseURL, 'Base URL must be configured to run reservation wizard e2e assertions.');

    await page.goto('/wizard');
    await expect(page.getByRole('heading', { name: 'Plan your visit' })).toBeVisible();

    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Please select a date.')).toBeVisible();

    await page.getByRole('button', { name: 'Select a date' }).click();
    await page.getByRole('gridcell', { name: /1/ }).first().click();

    const timeButton = page.getByRole('button', { name: /12:00/ }).first();
    await timeButton.click();

    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Tell us how to reach you' })).toBeVisible();
  });
});
