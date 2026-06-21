import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260516070700_harden_soft_hold_rpc_authorization.sql'),
  'utf8',
);
const compactMigration = migration.replace(/\s+/g, ' ');

const serviceOnlyRpcSignatures = [
  'public.acquire_soft_holds_atomic(uuid[], tstzrange, uuid, uuid, uuid, integer)',
  'public.release_soft_holds(uuid, uuid[])',
  'public.check_soft_hold_ownership(uuid, uuid[], tstzrange)',
  'public.cleanup_expired_soft_holds(integer)',
];

describe('soft-hold RPC security migration', () => {
  it('keeps soft-hold RPC execution service-role only', () => {
    for (const signature of serviceOnlyRpcSignatures) {
      expect(compactMigration).toContain(`REVOKE ALL ON FUNCTION ${signature} FROM PUBLIC;`);
      expect(compactMigration).toContain(`REVOKE ALL ON FUNCTION ${signature} FROM anon;`);
      expect(compactMigration).toContain(`REVOKE ALL ON FUNCTION ${signature} FROM authenticated;`);
      expect(compactMigration).toContain(`GRANT EXECUTE ON FUNCTION ${signature} TO service_role;`);
      expect(compactMigration).not.toContain(
        `GRANT EXECUTE ON FUNCTION ${signature} TO authenticated`,
      );
      expect(compactMigration).not.toContain(`GRANT EXECUTE ON FUNCTION ${signature} TO anon`);
    }
  });

  it('validates restaurant ownership for acquired tables and optional booking context', () => {
    expect(migration).toContain(
      'WHERE ti.id = ANY(v_requested_table_ids)\n    AND ti.restaurant_id = p_restaurant_id',
    );
    expect(migration).toContain(
      "RAISE EXCEPTION 'soft-hold tables must belong to the supplied restaurant'",
    );
    expect(migration).toContain(
      'WHERE b.id = p_booking_id\n      AND b.restaurant_id = p_restaurant_id',
    );
    expect(migration).toContain(
      "RAISE EXCEPTION 'soft-hold booking must belong to the supplied restaurant'",
    );
  });

  it('clamps TTL in the database and does not return blocking session tokens', () => {
    expect(migration).toContain(
      'v_ttl_seconds integer := GREATEST(5, LEAST(COALESCE(p_ttl_seconds, 10), 30));',
    );
    expect(migration).toContain(
      'v_expires_at timestamptz := v_now + make_interval(secs => v_ttl_seconds);',
    );
    expect(migration).toContain('blocking_session := NULL;');
    expect(migration).not.toContain('blocking_session := v_blocking.session_token');
  });
});
