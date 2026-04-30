/**
 * Phase 2 of the unified dual-sync engine.
 *
 * Wrapper around `updateRestaurantDetails` that:
 *   1. reads the Nabatable canonical snapshot before the write
 *   2. delegates to the existing Core writer
 *   3. reads the Nabatable canonical snapshot after the write
 *   4. runs `applyCoreWriteSideEffects` so changed fields are flagged
 *      `core_dirty` (or `pending_export` when a Google baseline exists)
 *      and an outbound candidate is queued for syncable scalars.
 *
 * The legacy / V2 paths can keep calling the un-wrapped writer directly;
 * dual-sync paths import this wrapper.
 */

import { readNabatableSnapshot } from '@/server/dual-sync/snapshots/nabatable';
import {
  updateRestaurantDetails,
  type RestaurantDetails,
  type UpdateRestaurantDetailsInput,
} from '@/server/restaurants/details';
import { getServiceSupabaseClient } from '@/server/supabase';

import { applyCoreWriteSideEffects } from './apply';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

export interface UpdateRestaurantDetailsWithSyncInput {
  readonly restaurantId: string;
  readonly input: UpdateRestaurantDetailsInput;
  readonly client?: DbClient;
  readonly actorUserId?: string | null;
}

export async function updateRestaurantDetailsWithSync({
  restaurantId,
  input,
  client = getServiceSupabaseClient(),
  actorUserId,
}: UpdateRestaurantDetailsWithSyncInput): Promise<RestaurantDetails> {
  const before = await readNabatableSnapshot({ client, restaurantId });
  const result = await updateRestaurantDetails(restaurantId, input, client);
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
