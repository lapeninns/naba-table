import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('data retention and profile hardening source guards', () => {
  it('keeps remembered guest contact retention aligned to the 6 hour UI disclosure', () => {
    const source = readSource(
      'reserve/features/reservations/wizard/hooks/useRememberedContacts.ts',
    );

    expect(source).toContain('const REMEMBERED_CONTACT_TTL_MS = 6 * 60 * 60 * 1000');
    expect(source).not.toContain('30 * 24 * 60 * 60 * 1000');
  });

  it('purges sms delivery rows before deleting bookings', () => {
    const source = readSource('scripts/purge-restaurant-bookings.ts');
    const smsIndex = source.indexOf("{ table: 'sms_delivery_log', bookingIdColumn: 'booking_id' }");
    const bookingDeleteIndex = source.indexOf(
      'purgeBookingsInTransaction(dbUrl, restaurant.id, deletes)',
    );

    expect(smsIndex).toBeGreaterThan(0);
    expect(bookingDeleteIndex).toBeGreaterThan(smsIndex);
  });

  it('hydrates profiles only from customer rows linked to the authenticated user', () => {
    const source = readSource('lib/profile/server.ts');

    expect(source).toContain('auth_user_id.eq.${userId}');
    expect(source).toContain('user_profile_id.eq.${userId}');
    expect(source).toContain(".eq('email_normalized', normalizedEmail)");
  });

  it('sets secure auth cookies in production even when using host-only cookies', () => {
    const supabaseSource = readSource('server/supabase.ts');
    const signoutSource = readSource('src/app/api/auth/signout/route.ts');

    expect(supabaseSource).toContain("const secureCookies = env.node.appEnv !== 'development';");
    expect(supabaseSource).not.toContain(
      "secureCookies = env.node.appEnv !== 'development' && COOKIE_DOMAIN",
    );
    expect(signoutSource).toContain("const secureCookies = env.node.appEnv !== 'development';");
    expect(signoutSource).not.toContain(
      'secureCookies = env.node.appEnv !== "development" && COOKIE_DOMAIN',
    );
  });
});
