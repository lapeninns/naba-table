/**
 * Ops Redirect Coverage E2E Tests
 *
 * Validates canonical redirects for restaurant-facing routes.
 */

import { test, expect } from '../fixtures/ops-auth.fixture';

const OPS_BASE_URL = process.env.E2E_OPS_BASE_URL || process.env.OPS_BASE_URL || 'http://localhost:3000';
const WEB_BASE_URL = process.env.E2E_BASE_URL || process.env.BASE_URL || 'http://localhost:3000';
const HAS_OPS_CREDS = Boolean(process.env.E2E_OPS_EMAIL && process.env.E2E_OPS_PASSWORD);
const OPS_HOST = OPS_BASE_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');
const OPS_HOST_REGEX = new RegExp(OPS_HOST.replace(/\./g, '\\.'), 'i');

test.setTimeout(45_000);

if (HAS_OPS_CREDS) {
  test.describe('@ops @smoke Ops Redirects', () => {
    test('main domain /app redirects to app subdomain', async ({ opsPage }) => {
      await opsPage.goto(`${WEB_BASE_URL}/app/bookings`);
      await expect(opsPage).toHaveURL(new RegExp(`${OPS_HOST_REGEX.source}\/bookings`));
    });

    test('app host canonicalizes /app prefix', async ({ opsPage }) => {
      await opsPage.goto(`${OPS_BASE_URL}/app/bookings`);
      await expect(opsPage).toHaveURL(new RegExp(`${OPS_HOST_REGEX.source}\/bookings`));
    });

    test('settings and management redirect to canonical pages', async ({ opsPage }) => {
      await opsPage.goto(`${OPS_BASE_URL}/settings`);
      await expect(opsPage).toHaveURL(/\/settings\/restaurant\/profile/);

      await opsPage.goto(`${OPS_BASE_URL}/management`);
      await expect(opsPage).toHaveURL(/\/settings\/restaurant\/team/);
    });
  });
}
