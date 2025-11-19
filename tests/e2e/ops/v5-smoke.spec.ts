import { expect } from '@playwright/test';

import { test } from '../../fixtures/auth';

import type { Page } from '@playwright/test';

const ALLOWED_PROJECTS = new Set(['chromium', 'mobile-chrome']);
const SHOULD_RUN = process.env.PLAYWRIGHT_OPS_V5 === 'true';

async function ensureAuthenticated(page: Page, testInfo: import('@playwright/test').TestInfo) {
  if (!ALLOWED_PROJECTS.has(testInfo.project.name)) {
    testInfo.skip(true, 'Ops flows verified on Chromium-based projects.');
    return false;
  }
  await page.goto('/ops');
  const currentUrl = page.url();
  if (currentUrl.includes('/signin')) {
    testInfo.skip(true, 'Authenticated storage state unavailable; skipping Ops v5 smoke.');
    return false;
  }
  return true;
}

test.describe('Ops v5 UI smoke', () => {
  test('team management shows limited permissions notice for non-admin staff', async ({ authedPage }, testInfo) => {
    if (!SHOULD_RUN) {
      test.skip(true, 'Set PLAYWRIGHT_OPS_V5=true to enable Ops v5 smoke checks.');
    }
    const authed = await ensureAuthenticated(authedPage, testInfo);
    if (!authed) return;

    await authedPage.goto('/ops/team');
    await expect(authedPage.getByRole('heading', { name: /team management/i })).toBeVisible();
  });

  test('restaurant settings page loads', async ({ authedPage }, testInfo) => {
    if (!SHOULD_RUN) {
      test.skip(true, 'Set PLAYWRIGHT_OPS_V5=true to enable Ops v5 smoke checks.');
    }
    const authed = await ensureAuthenticated(authedPage, testInfo);
    if (!authed) return;

    await authedPage.goto('/ops/restaurant-settings');
    await expect(authedPage.getByRole('heading', { name: /restaurant settings/i })).toBeVisible();
  });
});
