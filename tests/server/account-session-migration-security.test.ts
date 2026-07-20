import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260720120000_account_session_activity.sql'),
  'utf8',
).replace(/\s+/g, ' ');

describe('account device and session migration security', () => {
  it('keeps both ledgers behind RLS and removes direct client table access', () => {
    expect(migration).toContain('alter table public.account_devices enable row level security');
    expect(migration).toContain(
      'alter table public.account_session_activity enable row level security',
    );
    expect(migration).toContain(
      'revoke all on table public.account_devices from anon, authenticated',
    );
    expect(migration).toContain(
      'revoke all on table public.account_session_activity from anon, authenticated',
    );
  });

  it('scopes rename and activity functions to auth.uid without token storage', () => {
    expect(migration).toContain('current_user_id uuid := auth.uid()');
    expect(migration).toContain('where user_id = current_user_id and device_id = p_device_id');
    expect(migration).not.toMatch(/access_token|refresh_token|hmac_key/i);
  });

  it('grants only the intended user-facing functions to authenticated users', () => {
    expect(migration).toContain(
      'revoke all on function public.rename_my_account_device(uuid, text) from public, anon',
    );
    expect(migration).toContain(
      'grant execute on function public.rename_my_account_device(uuid, text) to authenticated',
    );
    expect(migration).toContain('account_session_activity_user_device_idx');
  });
});
