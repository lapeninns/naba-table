import { expect, test } from '@playwright/test';

const shouldRun = process.env.PLAYWRIGHT_TEST_IFRAME === 'true';

test.describe('lead capture iframe', () => {
  test.skip(!shouldRun, 'Enable PLAYWRIGHT_TEST_IFRAME=true once lead capture iframe is deployed.');

  test('submits form inside iframe', async ({ page }) => {
    await page.goto('/campaigns/spring');
    const frame = page.frameLocator('iframe[name="lead-capture"]');
    await frame.getByLabel('Email').fill('qa@example.com');
    await frame.getByRole('button', { name: /Notify me/i }).click();
    await expect(frame.getByText(/Thanks for joining/i)).toBeVisible();
  });
});
