import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { RestaurantSettingsPageShell } from '@/components/features/restaurant-settings/RestaurantSettingsPageShell';
import {
  OPS_ACTIVE_RESTAURANT_COOKIE_NAME,
  resolvePreferredOpsRestaurantId,
} from '@/lib/ops/session';
import { withRedirectedFrom } from '@/lib/url/withRedirectedFrom';
import { getServerComponentSupabaseClient } from '@/server/supabase';
import { fetchUserMembershipsCached, requireAdminMembership } from '@/server/team/access';

import type { ReactNode } from 'react';

export default async function RestaurantSettingsLayout({ children }: { children: ReactNode }) {
  const supabase = await getServerComponentSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error('[settings/restaurant] failed to resolve auth', error.message);
  }

  if (!user) {
    redirect(withRedirectedFrom('/app/auth/signin', '/app/settings/restaurant/profile'));
  }

  const memberships = await fetchUserMembershipsCached(user.id);
  const cookieStore = await cookies();
  const activeRestaurantId = resolvePreferredOpsRestaurantId(
    memberships.map((membership) => membership.restaurant_id),
    cookieStore.get(OPS_ACTIVE_RESTAURANT_COOKIE_NAME)?.value ?? null,
  );

  if (!activeRestaurantId) {
    redirect('/app/bookings');
  }

  try {
    await requireAdminMembership({ userId: user.id, restaurantId: activeRestaurantId });
  } catch (membershipError) {
    console.warn('[settings/restaurant] denied non-admin settings access', {
      userId: user.id,
      restaurantId: activeRestaurantId,
      error: membershipError instanceof Error ? membershipError.message : String(membershipError),
    });
    redirect('/app/bookings');
  }

  return <RestaurantSettingsPageShell>{children}</RestaurantSettingsPageShell>;
}
