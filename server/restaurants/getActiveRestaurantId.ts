import { getServiceSupabaseClient } from '@/server/supabase';

export async function getActiveRestaurantId(restaurantId: string): Promise<string | null> {
  const normalized = restaurantId.trim();
  if (!normalized) {
    return null;
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('restaurants')
    .select('id')
    .eq('id', normalized)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve active restaurant: ${error.message}`);
  }

  return data?.id ?? null;
}
