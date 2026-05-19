import { getDualSyncDbClient } from './db';
import { DUAL_SYNC_PROVIDER } from './types';

import type { DualSyncRestaurantControlRow } from './db';
import type { DualSyncRestaurantControl } from './types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;
type MaybeQueryBuilder = {
  select?: (columns: string) => MaybeQueryBuilder;
  eq?: (column: string, value: string) => MaybeQueryBuilder;
  maybeSingle?: () => Promise<{ data: DualSyncRestaurantControlRow | null; error: unknown }>;
};

export const DUAL_SYNC_RESTAURANT_PAUSED_CODE = 'DUAL_SYNC_RESTAURANT_PAUSED' as const;

export class DualSyncRestaurantPausedError extends Error {
  readonly code = DUAL_SYNC_RESTAURANT_PAUSED_CODE;
  readonly control: DualSyncRestaurantControl;

  constructor(control: DualSyncRestaurantControl) {
    super(control.pauseReason ?? 'Dual-sync is paused for this restaurant.');
    this.name = 'DualSyncRestaurantPausedError';
    this.control = control;
  }
}

function defaultControl(restaurantId: string): DualSyncRestaurantControl {
  return {
    restaurantId,
    provider: DUAL_SYNC_PROVIDER,
    syncPaused: false,
    pauseReason: null,
    pausedByUserId: null,
    pausedAt: null,
    resumedAt: null,
    createdAt: null,
    updatedAt: null,
  };
}

function mapControl(row: DualSyncRestaurantControlRow): DualSyncRestaurantControl {
  return {
    restaurantId: row.restaurant_id,
    provider: row.provider,
    syncPaused: row.sync_paused,
    pauseReason: row.pause_reason,
    pausedByUserId: row.paused_by_user_id,
    pausedAt: row.paused_at,
    resumedAt: row.resumed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function isDualSyncRestaurantPausedError(
  error: unknown,
): error is DualSyncRestaurantPausedError {
  return (
    error instanceof DualSyncRestaurantPausedError ||
    (Boolean(error) &&
      typeof error === 'object' &&
      (error as { code?: unknown }).code === DUAL_SYNC_RESTAURANT_PAUSED_CODE)
  );
}

export async function getDualSyncRestaurantControl({
  client,
  restaurantId,
}: {
  readonly client: DbClient;
  readonly restaurantId: string;
}): Promise<DualSyncRestaurantControl> {
  const db = getDualSyncDbClient(client);
  const maybeDb = db as unknown as { from?: (table: string) => MaybeQueryBuilder | undefined };
  if (typeof maybeDb.from !== 'function') {
    return defaultControl(restaurantId);
  }

  const table = maybeDb.from('dual_sync_restaurant_controls');
  if (!table || typeof table.select !== 'function') {
    return defaultControl(restaurantId);
  }
  const selected = table.select(
    'restaurant_id,provider,sync_paused,pause_reason,paused_by_user_id,paused_at,resumed_at,created_at,updated_at',
  );
  if (!selected || typeof selected.eq !== 'function') {
    return defaultControl(restaurantId);
  }
  const byRestaurant = selected.eq('restaurant_id', restaurantId);
  if (!byRestaurant || typeof byRestaurant.eq !== 'function') {
    return defaultControl(restaurantId);
  }
  const byProvider = byRestaurant.eq('provider', DUAL_SYNC_PROVIDER);
  if (!byProvider || typeof byProvider.maybeSingle !== 'function') {
    return defaultControl(restaurantId);
  }

  const { data, error } = await byProvider.maybeSingle();

  if (error) throw error;
  return data ? mapControl(data) : defaultControl(restaurantId);
}

export async function setDualSyncRestaurantPaused({
  client,
  restaurantId,
  paused,
  reason,
  actorUserId,
}: {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly paused: boolean;
  readonly reason?: string | null;
  readonly actorUserId?: string | null;
}): Promise<DualSyncRestaurantControl> {
  const db = getDualSyncDbClient(client);
  const now = new Date().toISOString();
  const payload = {
    restaurant_id: restaurantId,
    provider: DUAL_SYNC_PROVIDER,
    sync_paused: paused,
    pause_reason: paused ? reason?.trim() || 'Paused by operator.' : null,
    paused_by_user_id: paused ? (actorUserId ?? null) : null,
    paused_at: paused ? now : null,
    resumed_at: paused ? null : now,
  };
  const { data, error } = await db
    .from('dual_sync_restaurant_controls')
    .upsert(payload as never, { onConflict: 'restaurant_id,provider' })
    .select(
      'restaurant_id,provider,sync_paused,pause_reason,paused_by_user_id,paused_at,resumed_at,created_at,updated_at',
    )
    .single();

  if (error) throw error;
  return mapControl(data);
}

export async function assertDualSyncRestaurantNotPaused(input: {
  readonly client: DbClient;
  readonly restaurantId: string;
}): Promise<void> {
  const control = await getDualSyncRestaurantControl(input);
  if (control.syncPaused) {
    throw new DualSyncRestaurantPausedError(control);
  }
}
