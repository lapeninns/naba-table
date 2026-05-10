/**
 * Phase 2 of the unified dual-sync engine.
 *
 * Wrapper around `updateRestaurantBusinessContext`. Business-context
 * registry entries are computed dynamically from the snapshot pair so
 * newly-added rows are picked up automatically.
 */

import { readNabatableSnapshot } from '@/server/dual-sync/snapshots/nabatable';
import {
  updateRestaurantBusinessContext,
  type RestaurantBusinessContextChangeProvenance,
  type RestaurantBusinessContextSnapshot,
  type UpdateRestaurantBusinessContextInput,
} from '@/server/restaurants/businessContext';
import { getServiceSupabaseClient } from '@/server/supabase';

import { applyCoreWriteSideEffects } from './apply';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

export interface UpdateRestaurantBusinessContextWithSyncInput {
  readonly restaurantId: string;
  readonly input: UpdateRestaurantBusinessContextInput;
  readonly client?: DbClient;
  readonly provenance?: RestaurantBusinessContextChangeProvenance;
  readonly actorUserId?: string | null;
}

export async function updateRestaurantBusinessContextWithSync({
  restaurantId,
  input,
  client = getServiceSupabaseClient(),
  provenance,
  actorUserId,
}: UpdateRestaurantBusinessContextWithSyncInput): Promise<RestaurantBusinessContextSnapshot> {
  const before = await readNabatableSnapshot({ client, restaurantId });
  const result = await updateRestaurantBusinessContext(restaurantId, input, client, provenance);
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
