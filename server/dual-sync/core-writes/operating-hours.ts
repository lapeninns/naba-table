/**
 * Phase 2 of the unified dual-sync engine.
 *
 * Wrapper around `updateOperatingHours` mirroring `details.ts`. Per-day
 * weekly entries are tracked as separate registry fields
 * (`operatingHours.weekly.0..6`).
 */

import { readNabatableSnapshot } from '@/server/dual-sync/snapshots/nabatable';
import {
  updateOperatingHours,
  type OperatingHoursSnapshot,
  type UpdateOperatingHoursPayload,
} from '@/server/restaurants/operatingHours';
import { getServiceSupabaseClient } from '@/server/supabase';

import { applyCoreWriteSideEffects } from './apply';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

export interface UpdateOperatingHoursWithSyncInput {
  readonly restaurantId: string;
  readonly payload: UpdateOperatingHoursPayload;
  readonly client?: DbClient;
  readonly actorUserId?: string | null;
}

export async function updateOperatingHoursWithSync({
  restaurantId,
  payload,
  client = getServiceSupabaseClient(),
  actorUserId,
}: UpdateOperatingHoursWithSyncInput): Promise<OperatingHoursSnapshot> {
  const before = await readNabatableSnapshot({ client, restaurantId });
  const result = await updateOperatingHours(restaurantId, payload, client);
  const after = await readNabatableSnapshot({ client, restaurantId });

  await applyCoreWriteSideEffects({
    client,
    restaurantId,
    before,
    after,
    actorUserId,
  });

  return result;
}
