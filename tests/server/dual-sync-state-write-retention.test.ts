import { describe, expect, it, vi } from 'vitest';

import { upsertFieldState } from '@/server/dual-sync/state/write';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

describe('field-state retention producer', () => {
  it('persists arbitrary metadata as hash and shape only', async () => {
    const row = {
      id: 'state-1',
      restaurant_id: 'rest-1',
      provider: 'google_business_profile',
      section_key: 'profile',
      field_key: 'profile.name',
      state: 'in_sync',
      core_value_hash: 'core-hash',
      gbp_value_hash: 'google-hash',
      last_in_sync_hash: null,
      last_core_change_at: null,
      last_gbp_change_at: null,
      last_in_sync_at: null,
      last_snapshot_run_id: null,
      metadata: {},
      created_at: '2026-08-09T10:00:00.000Z',
      updated_at: '2026-08-09T10:00:00.000Z',
    };
    const chain: Record<string, unknown> = {};
    const fluent = vi.fn(() => chain);
    Object.assign(chain, {
      upsert: fluent,
      select: fluent,
      single: vi.fn().mockResolvedValue({ data: row, error: null }),
    });
    const client = { from: vi.fn(() => chain) } as unknown as SupabaseClient<Database>;

    await upsertFieldState({
      client,
      restaurantId: 'rest-1',
      sectionKey: 'profile',
      fieldKey: 'profile.name',
      state: 'in_sync',
      metadata: { providerValue: 'Private Google name', accessToken: 'secret-token' },
    });

    const persisted = vi.mocked(chain.upsert as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(persisted.metadata).toEqual({
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      shape: { kind: 'object', fieldCount: 2 },
    });
    expect(JSON.stringify(persisted)).not.toContain('Private Google name');
    expect(JSON.stringify(persisted)).not.toContain('secret-token');
  });
});
