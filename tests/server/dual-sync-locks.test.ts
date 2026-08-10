import { describe, expect, it, vi } from 'vitest';

const loggerErrorMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/logger', () => ({ logger: { error: loggerErrorMock } }));

import {
  DualSyncLockError,
  DUAL_SYNC_LOCK_HELD_CODE,
  runWithDualSyncLock,
} from '@/server/dual-sync/locks';

import type { DualSyncLock, DualSyncLockManager } from '@/server/dual-sync/locks';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

const client = {} as SupabaseClient<Database>;

const lock: DualSyncLock = {
  id: 'lock-1',
  restaurantId: 'rest-1',
  jobKind: 'publish_batch',
  holderId: 'holder-1',
  acquiredAt: '2026-05-09T00:00:00.000Z',
  expiresAt: '2026-05-09T00:05:00.000Z',
};

describe('runWithDualSyncLock', () => {
  it('acquires and releases a restaurant/provider lock around the job', async () => {
    const manager: DualSyncLockManager = {
      acquire: vi.fn(async () => lock),
      release: vi.fn(async () => {}),
    };

    const result = await runWithDualSyncLock(
      {
        client,
        restaurantId: 'rest-1',
        jobKind: 'publish_batch',
        holderId: 'client-request-1',
        manager,
      },
      async (heldLock) => `ran:${heldLock.id}`,
    );

    expect(result).toBe('ran:lock-1');
    expect(manager.acquire).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: 'rest-1',
        jobKind: 'publish_batch',
        holderId: 'client-request-1',
      }),
    );
    expect(manager.release).toHaveBeenCalledWith(lock);
  });

  it('renews long-running locks before their TTL expires', async () => {
    vi.useFakeTimers();
    const renewedLock: DualSyncLock = {
      ...lock,
      expiresAt: '2026-05-09T00:10:00.000Z',
    };
    const manager: DualSyncLockManager = {
      acquire: vi.fn(async () => lock),
      renew: vi.fn(async () => renewedLock),
      release: vi.fn(async () => {}),
    };

    const resultPromise = runWithDualSyncLock(
      {
        client,
        restaurantId: 'rest-1',
        jobKind: 'publish_batch',
        ttlMs: 3_000,
        manager,
      },
      async () => {
        await vi.advanceTimersByTimeAsync(1_100);
        return 'done';
      },
    );

    await expect(resultPromise).resolves.toBe('done');
    expect(manager.renew).toHaveBeenCalledWith(lock, 3_000);
    expect(manager.release).toHaveBeenCalledWith(renewedLock);
    vi.useRealTimers();
  });

  it('releases the lock when the protected job throws', async () => {
    const manager: DualSyncLockManager = {
      acquire: vi.fn(async () => lock),
      release: vi.fn(async () => {}),
    };

    await expect(
      runWithDualSyncLock(
        {
          client,
          restaurantId: 'rest-1',
          jobKind: 'google_refresh_manual',
          manager,
        },
        async () => {
          throw new Error('provider unavailable');
        },
      ),
    ).rejects.toThrow('provider unavailable');

    expect(manager.release).toHaveBeenCalledWith(lock);
  });

  it('surfaces a lock-held error without running the protected job', async () => {
    const manager: DualSyncLockManager = {
      acquire: vi.fn(async () => {
        throw new DualSyncLockError('already running', lock);
      }),
      release: vi.fn(async () => {}),
    };
    const work = vi.fn(async () => 'should-not-run');

    await expect(
      runWithDualSyncLock(
        {
          client,
          restaurantId: 'rest-1',
          jobKind: 'publish_batch',
          manager,
        },
        work,
      ),
    ).rejects.toMatchObject({
      code: DUAL_SYNC_LOCK_HELD_CODE,
      activeLock: lock,
    });

    expect(work).not.toHaveBeenCalled();
    expect(manager.release).not.toHaveBeenCalled();
  });

  it('records a safe release failure and preserves the protected-job failure', async () => {
    // Given
    const secret = 'Bearer provider-secret guest@example.com';
    const workFailure = new Error('publish failed');
    const manager: DualSyncLockManager = {
      acquire: vi.fn(async () => lock),
      release: vi.fn(async () => {
        throw new Error(secret);
      }),
    };

    // When
    const result = runWithDualSyncLock(
      {
        client,
        restaurantId: 'rest-1',
        jobKind: 'publish_batch',
        manager,
      },
      async () => {
        throw workFailure;
      },
    );

    // Then
    await expect(result).rejects.toBe(workFailure);
    expect(loggerErrorMock).toHaveBeenCalledWith(
      'Dual-sync lock release failed after job failure.',
      {
        module: 'dual-sync-locks',
        restaurantId: 'rest-1',
        jobKind: 'publish_batch',
        lockId: 'lock-1',
        errorKind: 'error',
      },
    );
    expect(JSON.stringify(loggerErrorMock.mock.calls)).not.toContain(secret);
  });
});
