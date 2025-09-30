import { test, expect } from '@playwright/test';

test.describe('Profile manage route', () => {
  test('redirects unauthenticated users to the login page', async ({ page }) => {
    await page.goto('http://localhost:3000/profile/manage');
    await expect(page).toHaveURL(/\/signin\?redirectedFrom=%2Fprofile%2Fmanage/);
  });
});
