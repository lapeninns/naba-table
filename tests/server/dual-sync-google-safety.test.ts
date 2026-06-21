import { describe, expect, it, vi } from 'vitest';

import {
  InMemoryDualSyncGoogleEditThrottle,
  SupabaseDualSyncGoogleEditThrottle,
  reserveGoogleEditBudget,
} from '@/server/dual-sync/publish/google-safety';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

describe('dual-sync Google edit throttle', () => {
  it('allows requests until the per-location window is exhausted', async () => {
    const throttle = new InMemoryDualSyncGoogleEditThrottle(2, 60_000);

    await expect(
      reserveGoogleEditBudget({
        throttle,
        restaurantId: 'rest-1',
        writeGroup: 'location.profile',
      }),
    ).resolves.toBeNull();
    await expect(
      reserveGoogleEditBudget({
        throttle,
        restaurantId: 'rest-1',
        writeGroup: 'location.profile',
      }),
    ).resolves.toBeNull();

    const failure = await reserveGoogleEditBudget({
      throttle,
      restaurantId: 'rest-1',
      writeGroup: 'location.profile',
    });

    expect(failure).toMatchObject({
      code: 'QUOTA_LIMITED',
      retryable: true,
    });
  });

  it('keeps location budgets isolated', async () => {
    const throttle = new InMemoryDualSyncGoogleEditThrottle(1, 60_000);

    await reserveGoogleEditBudget({
      throttle,
      restaurantId: 'rest-1',
      writeGroup: 'location.profile',
    });

    await expect(
      reserveGoogleEditBudget({
        throttle,
        restaurantId: 'rest-2',
        writeGroup: 'location.profile',
      }),
    ).resolves.toBeNull();
  });

  it('reserves durable budget through the Supabase RPC', async () => {
    const rpc = vi.fn(async () => ({
      data: [{ allowed: true, retry_after_ms: null, remaining: 8 }],
      error: null,
    }));
    const client = { rpc } as unknown as SupabaseClient<Database>;
    const throttle = new SupabaseDualSyncGoogleEditThrottle(client, 10, 60_000);

    const decision = await throttle.reserve({
      restaurantId: 'rest-1',
      writeGroup: 'location.profile',
      nowMs: Date.parse('2026-05-09T12:00:00.000Z'),
    });

    expect(rpc).toHaveBeenCalledWith('dual_sync_reserve_google_edit_budget', {
      p_restaurant_id: 'rest-1',
      p_write_group: 'location.profile',
      p_limit: 10,
      p_window_ms: 60000,
      p_now: '2026-05-09T12:00:00.000Z',
    });
    expect(decision).toEqual({
      allowed: true,
      retryAfterMs: null,
      remaining: 8,
    });
  });

  it('maps durable budget exhaustion and reservation failures to retryable quota failures', async () => {
    const exhaustedClient = {
      rpc: vi.fn(async () => ({
        data: [{ allowed: false, retry_after_ms: 1234, remaining: 0 }],
        error: null,
      })),
    } as unknown as SupabaseClient<Database>;

    await expect(
      reserveGoogleEditBudget({
        throttle: new SupabaseDualSyncGoogleEditThrottle(exhaustedClient, 1, 60_000),
        restaurantId: 'rest-1',
        writeGroup: 'location.profile',
      }),
    ).resolves.toMatchObject({
      code: 'QUOTA_LIMITED',
      retryable: true,
      message: expect.stringContaining('1234ms'),
    });

    const failingClient = {
      rpc: vi.fn(async () => ({
        data: null,
        error: { message: 'rpc unavailable' },
      })),
    } as unknown as SupabaseClient<Database>;

    await expect(
      reserveGoogleEditBudget({
        throttle: new SupabaseDualSyncGoogleEditThrottle(failingClient),
        restaurantId: 'rest-1',
        writeGroup: 'location.profile',
      }),
    ).resolves.toMatchObject({
      code: 'QUOTA_LIMITED',
      retryable: true,
      message: expect.stringContaining('rpc unavailable'),
    });
  });
});
