import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';

import { stagingEnv } from './env';

const staging = stagingEnv();

const PRIVILEGED_RPCS = [
  'create_booking_with_capacity_check',
  'update_booking_with_capacity_check',
  'release_hold_and_emit',
  'set_hold_conflict_enforcement',
] as const;

test.describe('cross-tenant denial and RPC authorization', () => {
  test('spoofed tenant headers never unlock another tenant through the ops API @staging @p0 @security', async ({
    request,
  }) => {
    // The proxy derives the trusted tenant header from the session; a caller-supplied one
    // must be ignored and the request rejected without a session.
    for (const tenant of [staging.tenantA, staging.tenantB]) {
      const response = await request.get(
        `${staging.opsUrl}/api/ops/bookings?restaurantId=${tenant.id}`,
        {
          headers: {
            'x-restaurant-id': staging.tenantB.id,
            'x-ops-restaurant-id': staging.tenantB.id,
          },
          failOnStatusCode: false,
        },
      );
      expect([401, 403]).toContain(response.status());
      const text = await response.text();
      expect(text).not.toContain(staging.guest.email);
    }
  });

  test('guest booking lookup requires a recovery token bound to the contact @staging @p0 @security', async ({
    request,
  }) => {
    const response = await request.get(
      `${staging.publicUrl}/api/bookings/${randomUUID()}?access_token=not-a-valid-token`,
      { failOnStatusCode: false },
    );
    expect([400, 401, 403, 404]).toContain(response.status());
  });

  test('anon role cannot execute privileged security-definer RPCs @staging @p0 @security', async ({
    request,
  }) => {
    const supabaseUrl = staging.optional.STAGING_SUPABASE_URL;
    const anonKey = staging.optional.STAGING_SUPABASE_ANON_KEY;
    test.skip(
      !supabaseUrl || !anonKey,
      'STAGING_SUPABASE_URL / STAGING_SUPABASE_ANON_KEY not provided',
    );
    for (const rpc of PRIVILEGED_RPCS) {
      const response = await request.post(`${supabaseUrl}/rest/v1/rpc/${rpc}`, {
        headers: { apikey: anonKey ?? '', authorization: `Bearer ${anonKey ?? ''}` },
        data: {},
        failOnStatusCode: false,
      });
      expect([401, 403, 404], `${rpc} must not be callable by anon`).toContain(response.status());
    }
  });

  test.fixme('authenticated tenant B session is denied tenant A RPC data @staging @security', async () => {
    // Requires a staging ops session for tenant B (auth relay not provisioned); the assertion
    // is that RPCs scoped by restaurant_id return zero rows / permission errors for tenant A.
  });
});
