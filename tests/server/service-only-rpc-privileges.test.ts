import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260527111100_harden_service_only_rpc_privileges.sql'),
  'utf8',
);
const compactMigration = migration.replace(/\s+/g, ' ');

const serviceOnlyRpcSignatures = [
  [
    'public.create_booking_with_capacity_check( uuid, uuid, date, time without time zone, time without time zone, integer, text, text, text, text, text, text, boolean, text, text, uuid, text, jsonb, integer )',
    'create_booking_with_capacity_check',
  ],
  [
    'public.upsert_restaurant_menu_item_with_modifiers(uuid, jsonb)',
    'upsert_restaurant_menu_item_with_modifiers',
  ],
  [
    'public.import_restaurant_menu_bundle(uuid, jsonb, jsonb, jsonb, boolean)',
    'import_restaurant_menu_bundle',
  ],
  [
    'public.upsert_restaurant_drink_menu_item_with_modifiers(uuid, jsonb)',
    'upsert_restaurant_drink_menu_item_with_modifiers',
  ],
  [
    'public.import_restaurant_drink_menu_bundle(uuid, jsonb, jsonb, jsonb, boolean)',
    'import_restaurant_drink_menu_bundle',
  ],
] as const;

describe('service-only RPC privilege hardening migration', () => {
  it('revokes direct execution from public browser roles and grants service-role only', () => {
    for (const [signature, name] of serviceOnlyRpcSignatures) {
      expect(compactMigration).toContain(`REVOKE ALL ON FUNCTION ${signature} FROM PUBLIC;`);
      expect(compactMigration).toContain(`REVOKE ALL ON FUNCTION ${signature} FROM anon;`);
      expect(compactMigration).toContain(`REVOKE ALL ON FUNCTION ${signature} FROM authenticated;`);
      expect(compactMigration).toContain(`GRANT EXECUTE ON FUNCTION ${signature} TO service_role;`);
      expect(compactMigration).not.toContain(`GRANT EXECUTE ON FUNCTION ${signature} TO anon`);
      expect(compactMigration).not.toContain(
        `GRANT EXECUTE ON FUNCTION ${signature} TO authenticated`,
      );
      expect(migration).toContain(name);
    }
  });

  it('documents containment and rollback posture for staging-first rollout', () => {
    expect(migration).toContain('Containment:');
    expect(migration).toContain('Rollback:');
    expect(migration).toContain('Do not grant direct execution to anon or authenticated clients.');
  });
});
