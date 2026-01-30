/**
 * Ops Route Coverage E2E Tests
 *
 * Validates restaurant-facing routes render with authenticated access.
 */

import { test, expect } from '../fixtures/ops-auth.fixture';
import type { Page } from '@playwright/test';

const OPS_BASE_URL = process.env.E2E_OPS_BASE_URL || process.env.OPS_BASE_URL || 'http://localhost:3000';
const HAS_OPS_CREDS = Boolean(process.env.E2E_OPS_EMAIL && process.env.E2E_OPS_PASSWORD);

async function visitOpsRoute(page: Page, path: string, heading: RegExp) {
  await page.goto(`${OPS_BASE_URL}${path}`);
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('button', { name: /log out/i })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('heading', { name: heading })).toBeVisible({ timeout: 10_000 });
}

test.setTimeout(60_000);

test.describe.serial('@ops @smoke Ops Route Coverage', () => {
  test.skip(!HAS_OPS_CREDS, 'Ops credentials not configured (E2E_OPS_EMAIL/E2E_OPS_PASSWORD).');

  test('core ops routes render', async ({ opsPage }) => {
    await test.step('Dashboard', async () => {
      await visitOpsRoute(opsPage, '/dashboard', /operations/i);
    });

    await test.step('Bookings', async () => {
      await visitOpsRoute(opsPage, '/bookings', /manage bookings/i);
    });

    await test.step('New booking wizard', async () => {
      await visitOpsRoute(opsPage, '/new-bookings', /create a new booking/i);
    });

    await test.step('Customers', async () => {
      await visitOpsRoute(opsPage, '/customers', /customers/i);
    });
  });

  test('settings routes render', async ({ opsPage }) => {
    await test.step('Restaurant profile', async () => {
      await visitOpsRoute(opsPage, '/settings/restaurant/profile', /restaurant profile/i);
    });

    await test.step('Operating hours', async () => {
      await visitOpsRoute(opsPage, '/settings/restaurant/operating-hours', /operating hours/i);
    });

    await test.step('Service periods', async () => {
      await visitOpsRoute(opsPage, '/settings/restaurant/service-periods', /service periods/i);
    });

    await test.step('Occasions', async () => {
      await visitOpsRoute(opsPage, '/settings/restaurant/occasions', /booking occasions/i);
    });

    await test.step('Team settings', async () => {
      await visitOpsRoute(opsPage, '/settings/restaurant/team', /^team$/i);
    });

    await test.step('Tables', async () => {
      await visitOpsRoute(opsPage, '/settings/tables', /^tables$/i);
    });
  });
});
