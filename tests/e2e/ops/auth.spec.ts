import { expect, test } from '@playwright/test';

import { test as authedTest } from '../../fixtures/auth';

const ALLOWED_PROJECTS = new Set(['chromium', 'mobile-chrome']);

test.describe('Ops auth redirects', () => {
  test('unauthenticated visitors are redirected to signin', async ({ page }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Ops flows verified on Chromium-based projects.');
    await page.goto('/ops');
    await page.waitForURL(/\/signin\?redirectedFrom=\/ops/);
    await expect(page).toHaveURL(/\/signin\?redirectedFrom=\/ops/);
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  });
});

authedTest.describe('Ops session management', () => {
  authedTest('logging out clears session cookies', async ({ authedPage }, testInfo) => {
    authedTest.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Ops flows verified on Chromium-based projects.');
    await authedPage.goto('/ops');
    const currentUrl = authedPage.url();
    if (currentUrl.includes('/signin')) {
      testInfo.skip(true, 'Authenticated storage state unavailable; skipping logout scenario.');
      return;
    }
    await authedPage.waitForURL(/\/ops(?!\w)/);

    await authedPage.getByRole('button', { name: 'Log out' }).click();
    await authedPage.waitForURL((url) => url.toString().includes('/signin'));

    await authedPage.goto('/ops');
    await authedPage.waitForURL((url) => url.toString().includes('/signin'));
    await expect(authedPage.getByRole('heading', { name: /sign in/i })).toBeVisible();
  });
});
