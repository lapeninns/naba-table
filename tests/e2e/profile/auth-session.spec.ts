import { expect, test } from '@playwright/test';

const shouldRun = process.env.PLAYWRIGHT_TEST_AUTH_FLOW === 'true';

const demoEmail = process.env.PLAYWRIGHT_TEST_EMAIL ?? 'qa@example.com';
const demoPassword = process.env.PLAYWRIGHT_TEST_PASSWORD ?? 'password123';

test.describe('authentication session management', () => {
  test.skip(!shouldRun, 'Enable PLAYWRIGHT_TEST_AUTH_FLOW=true and supply credentials to exercise auth flow.');

  test('logs in and persists session', async ({ page, context, baseURL }) => {
    test.skip(!baseURL, 'Base URL must be configured.');

    await page.goto('/signin');
    await page.getByLabel(/email/i).fill(demoEmail);
    await page.getByLabel(/password/i).fill(demoPassword);
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page).toHaveURL(/dashboard/);

    const storage = await context.storageState();
    expect(storage.cookies.length).toBeGreaterThan(0);
  });
});
