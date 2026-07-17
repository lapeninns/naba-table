import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = join(
  process.cwd(),
  'supabase/migrations/20260716220000_restrict_ops_email_delivery_summary_execute.sql',
);

describe('ops email delivery summary RPC privileges', () => {
  it('keeps the summary RPC executable by service_role only', () => {
    const migration = readFileSync(migrationPath, 'utf8').replace(/\s+/g, ' ');

    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.ops_email_delivery_attempts_summary( uuid, text, text[], text, text, text, text, text ) FROM PUBLIC, anon, authenticated;',
    );
    expect(migration).toContain(
      'GRANT EXECUTE ON FUNCTION public.ops_email_delivery_attempts_summary( uuid, text, text[], text, text, text, text, text ) TO service_role;',
    );
  });
});
