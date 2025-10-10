import type { Metadata } from 'next';
import { HydrationBoundary, QueryClient, dehydrate } from '@tanstack/react-query';
import { redirect } from 'next/navigation';

import config from '@/config';
import { ManageRestaurantClient, type RestaurantMembershipOption } from '@/components/owner/ManageRestaurantClient';
import { getOperatingHours, getServicePeriods, getRestaurantDetails } from '@/server/restaurants';
import { fetchUserMemberships } from '@/server/team/access';
import { getServerComponentSupabaseClient } from '@/server/supabase';
import { queryKeys } from '@/lib/query/keys';

export const metadata: Metadata = {
  title: 'Manage restaurant · SajiloReserveX',
  description: 'Configure operating hours, service periods, and contact details for your restaurant.',
};

export const dynamic = 'force-dynamic';

export default async function OpsManageRestaurantPage() {
  const supabase = await getServerComponentSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error('[ops/manage-restaurant] auth resolution failed', authError.message);
  }

  if (!user) {
    const loginUrl = config.auth.loginUrl ?? '/signin';
    redirect(`${loginUrl}?redirectedFrom=/ops/manage-restaurant`);
  }

  const memberships = await fetchUserMemberships(user.id, supabase);
  const membershipOptions: RestaurantMembershipOption[] = memberships.map((membership) => ({
    restaurantId: membership.restaurant_id,
    restaurantName: membership.restaurants?.name ?? null,
    role: membership.role,
  }));

  const defaultRestaurantId = membershipOptions[0]?.restaurantId ?? null;
  const queryClient = new QueryClient();

  if (defaultRestaurantId) {
    try {
      const [hoursSnapshot, servicePeriods, details] = await Promise.all([
        getOperatingHours(defaultRestaurantId, supabase),
        getServicePeriods(defaultRestaurantId, supabase),
        getRestaurantDetails(defaultRestaurantId, supabase),
      ]);

      queryClient.setQueryData(queryKeys.ownerRestaurants.hours(defaultRestaurantId), hoursSnapshot);
      queryClient.setQueryData(queryKeys.ownerRestaurants.servicePeriods(defaultRestaurantId), servicePeriods);
      queryClient.setQueryData(queryKeys.ownerRestaurants.details(defaultRestaurantId), details);
    } catch (error) {
      console.error('[ops/manage-restaurant] failed to prefetch restaurant data', error);
    }
  }

  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationBoundary state={dehydratedState}>
      <ManageRestaurantClient memberships={membershipOptions} defaultRestaurantId={defaultRestaurantId} />
    </HydrationBoundary>
  );
}
