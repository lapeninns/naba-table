/**
 * Phase 2 of the unified dual-sync engine.
 *
 * Wrapper around `updateServicePeriods`. Service periods carry no stable
 * provider id, so the registry is computed on the fly from the union of
 * Core + Google `stableKey`s. After the write the wrapper rebuilds the
 * registry from the new snapshot pair so newly-renamed periods land in
 * the state machine.
 */

import { readNabatableSnapshot } from '@/server/dual-sync/snapshots/nabatable';
import {
  updateServicePeriods,
  type ServicePeriod,
  type UpdateServicePeriod,
} from '@/server/restaurants/servicePeriods';
import { getServiceSupabaseClient } from '@/server/supabase';

import { applyCoreWriteSideEffects } from './apply';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

export interface UpdateServicePeriodsWithSyncInput {
  readonly restaurantId: string;
  readonly periods: UpdateServicePeriod[];
  readonly client?: DbClient;
  readonly actorUserId?: string | null;
}

export async function updateServicePeriodsWithSync({
  restaurantId,
  periods,
  client = getServiceSupabaseClient(),
  actorUserId,
}: UpdateServicePeriodsWithSyncInput): Promise<ServicePeriod[]> {
  const before = await readNabatableSnapshot({ client, restaurantId });
  const result = await updateServicePeriods(restaurantId, periods, client);
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
