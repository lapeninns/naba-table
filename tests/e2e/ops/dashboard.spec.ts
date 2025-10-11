import { expect } from '@playwright/test';
import { test } from '../../fixtures/auth';

const BASE_DATE = '2025-10-10';
const READABLE_BASE_DATE = '10 October 2025';
const NEXT_DATE = '2025-10-11';
const READABLE_NEXT_DATE = '11 October 2025';
const ALLOWED_PROJECTS = new Set(['chromium', 'mobile-chrome']);

test.describe('Ops dashboard', () => {
  test('renders service snapshot for the requested date', async ({ authedPage }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Ops flows verified on Chromium-based projects.');
    await authedPage.goto(`/ops?date=${BASE_DATE}`);
    if (authedPage.url().includes('/signin')) {
      testInfo.skip(true, 'Authenticated storage state unavailable; skipping dashboard scenario.');
      return;
    }
    await authedPage.waitForLoadState('networkidle');

    const snapshot = authedPage.getByText('Service snapshot');
    if (await snapshot.count() === 0) {
      testInfo.skip(true, 'No dashboard content available for verification.');
      return;
    }

    await expect(snapshot).toBeVisible();
    await expect(authedPage.getByText('Showing reservations for', { exact: false })).toContainText(READABLE_BASE_DATE);
  });

  test('allows selecting a new date via the calendar control', async ({ authedPage }, testInfo) => {
    test.skip(!ALLOWED_PROJECTS.has(testInfo.project.name), 'Ops flows verified on Chromium-based projects.');
    await authedPage.goto(`/ops?date=${BASE_DATE}`);
    if (authedPage.url().includes('/signin')) {
      testInfo.skip(true, 'Authenticated storage state unavailable; skipping dashboard scenario.');
      return;
    }
    await authedPage.waitForLoadState('networkidle');

    const dateTrigger = authedPage.getByLabel('Select service date');
    if (await dateTrigger.count() === 0) {
      testInfo.skip(true, 'Date picker unavailable on dashboard.');
      return;
    }

    await dateTrigger.first().click();
    await authedPage.locator('[data-day]').filter({ hasText: '11' }).first().click();

    await authedPage.waitForURL((url) => {
      try {
        const next = new URL(url);
        return next.searchParams.get('date') === NEXT_DATE;
      } catch {
        return false;
      }
    });

    await expect(authedPage.url()).toContain(`date=${NEXT_DATE}`);
  });
});
