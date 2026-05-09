/**
 * Restaurant/provider lock boundary for write-affecting dual-sync work.
 *
 * State reads are intentionally outside this helper. Refresh, publish,
 * auto-export, and post-publish mirror refreshes must take this logical
 * lock so two jobs cannot mutate field state, candidates, mirrors, or
 * Google in parallel for the same restaurant/provider.
 */

import { randomUUID } from 'node:crypto';

import { getDualSyncDbClient } from './db';
import { DUAL_SYNC_PROVIDER } from './types';

import type { DualSyncLockRow } from './db';
import type { DualSyncLockJobKind } from './types';
import type { Database, Json } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

const DEFAULT_LOCK_TTL_MS = 5 * 60 * 1000;

export const DUAL_SYNC_LOCK_HELD_CODE = 'DUAL_SYNC_LOCK_HELD' as const;

export interface DualSyncLock {
  readonly id: string;
  readonly restaurantId: string;
  readonly jobKind: DualSyncLockJobKind;
  readonly holderId: string;
  readonly acquiredAt: string;
  readonly expiresAt: string;
}

export class DualSyncLockError extends Error {
  readonly code = DUAL_SYNC_LOCK_HELD_CODE;
  readonly retryable = true;
  readonly status = 409;
  readonly activeLock: DualSyncLock | null;

  constructor(message: string, activeLock: DualSyncLock | null = null) {
    super(message);
    this.name = 'DualSyncLockError';
    this.activeLock = activeLock;
  }
}

export function isDualSyncLockError(error: unknown): error is DualSyncLockError {
  return (
    error instanceof DualSyncLockError ||
    (typeof error === 'object' &&
      error !== null &&
      (error as { code?: unknown }).code === DUAL_SYNC_LOCK_HELD_CODE)
  );
}

export interface DualSyncLockManager {
  readonly acquire: (input: AcquireDualSyncLockInput) => Promise<DualSyncLock>;
  readonly release: (lock: DualSyncLock) => Promise<void>;
}

export interface AcquireDualSyncLockInput {
  readonly restaurantId: string;
  readonly jobKind: DualSyncLockJobKind;
  readonly holderId?: string;
  readonly ttlMs?: number;
  readonly metadata?: Record<string, unknown>;
}

export interface RunWithDualSyncLockInput extends AcquireDualSyncLockInput {
  readonly client: DbClient;
  readonly manager?: DualSyncLockManager;
}

function rowToLock(row: DualSyncLockRow): DualSyncLock {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    jobKind: row.job_kind,
    holderId: row.holder_id,
    acquiredAt: row.acquired_at,
    expiresAt: row.expires_at,
  };
}

function isUniqueViolation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === '23505' || /duplicate key/i.test(error.message ?? '');
}

export function createDatabaseDualSyncLockManager(client: DbClient): DualSyncLockManager {
  const dual = getDualSyncDbClient(client);

  return {
    async acquire(input) {
      const now = new Date();
      const nowIso = now.toISOString();
      const expiresAt = new Date(
        now.getTime() + (input.ttlMs ?? DEFAULT_LOCK_TTL_MS),
      ).toISOString();

      await dual
        .from('dual_sync_locks')
        .update({
          status: 'expired',
          released_at: nowIso,
          metadata: {
            expiredBy: 'dual-sync-lock-acquire',
          } satisfies Json,
        } as never)
        .eq('restaurant_id', input.restaurantId)
        .eq('provider', DUAL_SYNC_PROVIDER)
        .eq('status', 'held')
        .lte('expires_at', nowIso);

      const { data, error } = await dual
        .from('dual_sync_locks')
        .insert({
          restaurant_id: input.restaurantId,
          provider: DUAL_SYNC_PROVIDER,
          job_kind: input.jobKind,
          holder_id: input.holderId ?? randomUUID(),
          status: 'held',
          expires_at: expiresAt,
          metadata: (input.metadata ?? {}) as Json,
        } as never)
        .select('*')
        .single<DualSyncLockRow>();

      if (error) {
        if (isUniqueViolation(error)) {
          const { data: active } = await dual
            .from('dual_sync_locks')
            .select('*')
            .eq('restaurant_id', input.restaurantId)
            .eq('provider', DUAL_SYNC_PROVIDER)
            .eq('status', 'held')
            .order('acquired_at', { ascending: false })
            .limit(1)
            .maybeSingle<DualSyncLockRow>();
          throw new DualSyncLockError(
            `Dual-sync is already running for restaurant ${input.restaurantId}.`,
            active ? rowToLock(active) : null,
          );
        }
        throw error;
      }
      if (!data) {
        throw new Error('dual_sync_locks insert returned no row');
      }
      return rowToLock(data);
    },

    async release(lock) {
      const { error } = await dual
        .from('dual_sync_locks')
        .update({
          status: 'released',
          released_at: new Date().toISOString(),
        } as never)
        .eq('id', lock.id)
        .eq('status', 'held');
      if (error) throw error;
    },
  };
}

export async function runWithDualSyncLock<T>(
  input: RunWithDualSyncLockInput,
  work: (lock: DualSyncLock) => Promise<T>,
): Promise<T> {
  const manager = input.manager ?? createDatabaseDualSyncLockManager(input.client);
  const lock = await manager.acquire(input);
  let thrown: unknown;
  let result: T | undefined;
  let releaseError: unknown;
  try {
    result = await work(lock);
  } catch (error) {
    thrown = error;
  }
  try {
    await manager.release(lock);
  } catch (error) {
    releaseError = error;
    if (thrown) {
      console.error('[dual-sync][lock] failed to release lock after job error', {
        restaurantId: lock.restaurantId,
        jobKind: lock.jobKind,
        lockId: lock.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  if (thrown) throw thrown;
  if (releaseError) throw releaseError;
  return result as T;
}
