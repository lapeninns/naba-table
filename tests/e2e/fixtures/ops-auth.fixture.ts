/**
 * Ops Authentication Fixture for Playwright E2E Tests
 *
 * Provides authenticated browser context for restaurant-facing ops routes.
 */

import { test as base, type Page, type BrowserContext } from '@playwright/test';

const OPS_BASE_URL = process.env.E2E_OPS_BASE_URL || process.env.OPS_BASE_URL || 'http://localhost:3000';
const OPS_EMAIL = process.env.E2E_OPS_EMAIL || '';
const OPS_PASSWORD = process.env.E2E_OPS_PASSWORD || '';

const OPS_AUTH_STATE = 'playwright/.auth/ops.json';

export type OpsAuthFixtures = {
  opsPage: Page;
  opsContext: BrowserContext;
  opsBaseUrl: string;
  opsEmail: string;
};

async function signInOps(page: Page) {
  if (!OPS_EMAIL || !OPS_PASSWORD) {
    throw new Error('Missing E2E_OPS_EMAIL or E2E_OPS_PASSWORD for ops E2E tests.');
  }

  await page.goto(`${OPS_BASE_URL}/auth/signin`);
  await page.getByLabel(/email/i).fill(OPS_EMAIL);
  await page.getByLabel(/password/i).fill(OPS_PASSWORD);

  const submit = page.getByRole('button', { name: /sign in/i });
  await submit.click();

  await page.waitForLoadState('networkidle');
  await page.waitForURL(/\/dashboard|\/bookings|\/settings|\/customers|\/new-bookings/, { timeout: 15_000 });
}

export const test = base.extend<OpsAuthFixtures>({
  opsBaseUrl: OPS_BASE_URL,
  opsEmail: OPS_EMAIL,

  opsContext: async ({ browser }, use) => {
    let context: BrowserContext;

    try {
      context = await browser.newContext({ storageState: OPS_AUTH_STATE });
    } catch {
      context = await browser.newContext();
    }

    await use(context);
    await context.close();
  },

  opsPage: async ({ opsContext }, use) => {
    const page = await opsContext.newPage();

    await page.goto(`${OPS_BASE_URL}/dashboard`);
    if (page.url().includes('/auth/signin')) {
      await signInOps(page);
      await page.goto(`${OPS_BASE_URL}/dashboard`);
    }

    await use(page);
    await page.close();
  },
});

export { expect } from '@playwright/test';
