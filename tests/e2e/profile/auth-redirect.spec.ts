import { expect, test } from '@playwright/test';

test.describe('profile manage route', () => {
  test('redirects unauthenticated users to signin @smoke', async ({ page, baseURL }) => {
    test.skip(!baseURL, 'Base URL must be provided to run auth redirect test.');

    await page.goto('/profile/manage');
    await expect(page).toHaveURL(/\/signin\?redirectedFrom=%2Fprofile%2Fmanage/);
  });
});
