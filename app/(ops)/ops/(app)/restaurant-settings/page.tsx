import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { HydrationBoundary, QueryClient, dehydrate } from '@tanstack/react-query';

import config from '@/config';
import { OpsRestaurantSettingsClient } from '@/components/features';
import { RestaurantSettingsClient } from '@/components/ops/restaurant-settings/RestaurantSettingsClient';
import { fetchUserMemberships } from '@/server/team/access';
import { getOperatingHours, getServicePeriods } from '@/server/restaurants';
import { getServerComponentSupabaseClient, getServiceSupabaseClient } from '@/server/supabase';
import { queryKeys } from '@/lib/query/keys';

export const metadata: Metadata = {
  title: 'Restaurant Settings · SajiloReserveX Ops',
  description: 'Configure operating hours and service periods for your restaurant',
};

export default async function RestaurantSettingsPage() {
  const supabase = await getServerComponentSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error('[ops/restaurant-settings] failed to resolve auth', error.message);
  }

  if (!user) {
    const loginUrl = config.auth.loginUrl ?? '/signin';
    redirect(`${loginUrl}?redirectedFrom=/ops/restaurant-settings`);
  }

  const memberships = await fetchUserMemberships(user.id, supabase);
  const restaurants = memberships.map((m) => ({
    id: m.restaurant_id!,
    name: m.restaurants?.name ?? 'Restaurant',
    role: m.role,
  }));

  const defaultRestaurantId = restaurants[0]?.id ?? null;

  if (config.flags?.opsV5) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 py-6">
        <OpsRestaurantSettingsClient defaultRestaurantId={defaultRestaurantId} />
      </div>
    );
  }

  const queryClient = new QueryClient();
  const serviceSupabase = getServiceSupabaseClient();

  if (defaultRestaurantId) {
    try {
      const [hours, periods] = await Promise.all([
        getOperatingHours(defaultRestaurantId, serviceSupabase),
        getServicePeriods(defaultRestaurantId, serviceSupabase),
      ]);

      queryClient.setQueryData(queryKeys.ownerRestaurants.hours(defaultRestaurantId), hours);
      queryClient.setQueryData(queryKeys.ownerRestaurants.servicePeriods(defaultRestaurantId), periods);
    } catch (prefetchError) {
      console.error('[ops/restaurant-settings] prefetch failed', prefetchError);
    }
  }

  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationBoundary state={dehydratedState}>
      <RestaurantSettingsClient restaurants={restaurants} defaultRestaurantId={defaultRestaurantId} />
    </HydrationBoundary>
  );
}
