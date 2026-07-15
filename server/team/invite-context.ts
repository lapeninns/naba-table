import { getServiceSupabaseClient } from '@/server/supabase';

import type { RestaurantInvite } from './invite-types';

export async function resolveInviteContext(invite: RestaurantInvite): Promise<{
  restaurantName: string;
  inviterName: string | null;
}> {
  const service = getServiceSupabaseClient();
  const [{ data: restaurant }, { data: inviter }] = await Promise.all([
    service.from('restaurants').select('name').eq('id', invite.restaurant_id).maybeSingle(),
    invite.invited_by
      ? service.from('profiles').select('name').eq('id', invite.invited_by).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    restaurantName: restaurant?.name ?? 'Restaurant',
    inviterName: inviter?.name ?? null,
  };
}
