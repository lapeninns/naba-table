import { describe, expect, it } from 'vitest';

import {
  assertExactSupabaseApiProjectRef,
  assertExactSupabaseProjectRef,
  assertProductionScriptSafety,
} from '@/scripts/db/safety';

describe('script DB safety', () => {
  it('validates Supabase project refs exactly from DB host and user', () => {
    expect(
      assertExactSupabaseProjectRef(
        'postgresql://postgres.actualrefabcdefghijk:pw@aws-0-eu-west-2.pooler.supabase.com:6543/postgres',
        'actualrefabcdefghijk',
      ),
    ).toBe('actualrefabcdefghijk');

    expect(() =>
      assertExactSupabaseProjectRef(
        'postgresql://postgres:pw@db.notactualrefabcdefghijk.supabase.co:5432/postgres',
        'actualrefabcdefghijk',
      ),
    ).toThrow(/mismatch/);
  });

  it('validates Supabase API project refs exactly instead of substring matching', () => {
    expect(
      assertExactSupabaseApiProjectRef(
        'https://actualrefabcdefghij.supabase.co',
        'actualrefabcdefghij',
      ),
    ).toBe('actualrefabcdefghij');
    expect(() =>
      assertExactSupabaseApiProjectRef(
        'https://notactualrefabcdefghij.supabase.co',
        'actualrefabcdefghij',
      ),
    ).toThrow(/mismatch/);
  });

  it('fails closed for destructive production apply without confirmation and break-glass', () => {
    expect(() =>
      assertProductionScriptSafety({
        connectionString:
          'postgresql://postgres.actualrefabcdefghijk:pw@aws-0-eu-west-2.pooler.supabase.com:6543/postgres',
        expectedProjectRef: 'actualrefabcdefghijk',
        targetEnv: 'production',
        apply: true,
        destructive: true,
        requireRestaurant: true,
        targetRestaurant: 'the-venue',
        confirmation: 'true',
        breakGlass: undefined,
      }),
    ).toThrow(/break-glass/);
  });
});
