import { releaseTableHold } from '@/server/capacity/holds';

import type { Database, Tables } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type ServiceClient = SupabaseClient<Database>;

export type RestaurantTableHold = Pick<Tables<'table_holds'>, 'id' | 'status' | 'booking_id'>;

/** Loads a hold only if it belongs to the restaurant; another tenant's hold reads as missing. */
export async function findRestaurantTableHold(
  client: ServiceClient,
  restaurantId: string,
  holdId: string,
): Promise<RestaurantTableHold | null> {
  const { data, error } = await client
    .from('table_holds')
    .select('id, status, booking_id')
    .eq('id', holdId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ?? null;
}

export type ReleaseRestaurantTableHoldResult =
  | { found: false }
  | { found: true; holdId: string; alreadyReleased: boolean };

/**
 * Staff release of one hold. Tenant scoping comes from the lookup (hold identity is immutable in
 * the database, so the row cannot move restaurant between the lookup and the release). A hold that
 * is no longer active is reported as already released without touching it; an active one goes
 * through the canonical `releaseTableHold`, whose verified fallback also makes a concurrent
 * release idempotent.
 */
export async function releaseRestaurantTableHold(params: {
  client: ServiceClient;
  restaurantId: string;
  holdId: string;
  actorId: string;
}): Promise<ReleaseRestaurantTableHoldResult> {
  const { client, restaurantId, holdId, actorId } = params;
  const hold = await findRestaurantTableHold(client, restaurantId, holdId);
  if (!hold) {
    return { found: false };
  }
  if (hold.status !== 'active') {
    return { found: true, holdId: hold.id, alreadyReleased: true };
  }
  await releaseTableHold({ holdId: hold.id, client, actorId });
  return { found: true, holdId: hold.id, alreadyReleased: false };
}
