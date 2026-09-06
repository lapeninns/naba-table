import { randomUUID } from 'node:crypto';

import { stagingEnv } from './env';
import { expect, test } from './test';

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

  test('authenticated tenant B sees its membership but cannot read tenant A memberships @staging @p0 @security', async () => {
    const supabaseUrl = staging.optional.STAGING_SUPABASE_URL;
    const anonKey = staging.optional.STAGING_SUPABASE_ANON_KEY;
    const accessToken = staging.optional.STAGING_TENANT_B_ACCESS_TOKEN;
    test.skip(
      !supabaseUrl || !anonKey || !accessToken,
      'STAGING_SUPABASE_URL / STAGING_SUPABASE_ANON_KEY / STAGING_TENANT_B_ACCESS_TOKEN not provided',
    );
    expect(staging.tenantA.id === staging.tenantB.id, 'fixtures must be distinct tenants').toBe(
      false,
    );

    // Native fetch keeps session headers out of Playwright API traces and error call logs.
    // Only status and the narrowly selected membership identifiers are inspected below.
    const read = async (path: string): Promise<{ status: number; payload: unknown }> => {
      try {
        const response = await fetch(new URL(path, supabaseUrl), {
          headers: { apikey: anonKey ?? '', authorization: `Bearer ${accessToken ?? ''}` },
          redirect: 'manual',
          signal: AbortSignal.timeout(15_000),
        });
        return { status: response.status, payload: await response.json() };
      } catch {
        throw new Error(
          'Synthetic tenant authorization read failed; credentials and payload suppressed.',
        );
      }
    };
    const user = await read('/auth/v1/user');
    expect(user.status, 'tenant B session must be an authenticated user session').toBe(200);
    const userId =
      typeof user.payload === 'object' && user.payload !== null && 'id' in user.payload
        ? user.payload.id
        : undefined;
    expect(typeof userId === 'string', 'authenticated session must identify a user').toBe(true);

    const membershipPath = (restaurantId: string) =>
      `/rest/v1/restaurant_memberships?select=restaurant_id,user_id&restaurant_id=eq.${encodeURIComponent(restaurantId)}&limit=100`;
    const own = await read(membershipPath(staging.tenantB.id));
    expect(own.status, 'own membership query must execute successfully under RLS').toBe(200);
    const ownRows = Array.isArray(own.payload) ? own.payload : [];
    expect(
      ownRows.length > 0,
      'tenant B positive control must expose its existing membership',
    ).toBe(true);
    expect(
      ownRows.some(
        (row: unknown) =>
          typeof row === 'object' &&
          row !== null &&
          'restaurant_id' in row &&
          row.restaurant_id === staging.tenantB.id &&
          'user_id' in row &&
          row.user_id === userId,
      ),
      'visible membership must belong to the authenticated tenant B fixture owner',
    ).toBe(true);

    const other = await read(membershipPath(staging.tenantA.id));
    expect(other.status, 'cross-tenant query must reach RLS rather than fail authentication').toBe(
      200,
    );
    expect(Array.isArray(other.payload), 'membership endpoint must return rows').toBe(true);
    expect(
      Array.isArray(other.payload) ? other.payload.length : -1,
      'tenant A membership rows must be hidden',
    ).toBe(0);
  });
});
