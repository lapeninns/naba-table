import type { SupabaseClient } from '@supabase/supabase-js';

import { getServiceSupabaseClient } from '@/server/supabase';
import type { Database } from '@/types/supabase';

type DbClient = SupabaseClient<Database, 'public', any>;

export async function deleteRestaurant(
  restaurantId: string,
  client: DbClient = getServiceSupabaseClient(),
): Promise<void> {
  const { error } = await client.from('restaurants').delete().eq('id', restaurantId);

  if (error) {
    console.error('[deleteRestaurant] Delete failed', error);
    throw new Error(`Failed to delete restaurant: ${error.message}`);
  }
}
