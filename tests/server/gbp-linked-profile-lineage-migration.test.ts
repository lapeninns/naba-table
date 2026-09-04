import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260811160000_repair_gbp_linked_profile_lineage.sql'),
  'utf8',
).replace(/\s+/g, ' ');

describe('GBP linked profile lineage repair migration', () => {
  it('backfills linked Google rows without changing disconnected lineage semantics', () => {
    expect(migration).toContain("new.connection_status = 'linked'");
    expect(migration).toContain('new.external_profile_id := new.id::text');
    expect(migration).toContain("connection_status = 'linked'");
    expect(migration).toContain('set external_profile_id = id::text');
  });

  it('enforces lineage for future linked Google rows', () => {
    expect(migration).toContain(
      'before insert or update of connection_status, external_profile_id',
    );
    expect(migration).toContain('restaurant_external_profiles_linked_profile_lineage_v1_check');
    expect(migration).toContain("or connection_status <> 'linked'");
    expect(migration).toContain("or nullif(btrim(external_profile_id), '') is not null");
  });
});
