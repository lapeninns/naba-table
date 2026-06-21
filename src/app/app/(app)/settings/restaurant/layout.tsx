import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { RestaurantSettingsPageShell } from '@/components/features/restaurant-settings/RestaurantSettingsPageShell';
import {
  OPS_ACTIVE_RESTAURANT_COOKIE_NAME,
  resolvePreferredOpsRestaurantId,
} from '@/lib/ops/session';
import { APP_REQUEST_PATH_HEADER, sanitizeAppRequestPath } from '@/lib/url/app-request-path';
import { withRedirectedFrom } from '@/lib/url/withRedirectedFrom';
import { QA_OPS_AUTH_COOKIE_NAME, getQaOpsAuthFixture } from '@/server/auth/qa-ops-session';
import { resolveOpsEnvBanner } from '@/server/ops/resolve-ops-env-banner';
import { getServerComponentSupabaseClient } from '@/server/supabase';
import { fetchUserMembershipsCached, requireAdminMembership } from '@/server/team/access';

import type { ReactNode } from 'react';

const DEFAULT_SETTINGS_REDIRECT_FROM = '/app/settings/restaurant/profile';

export default async function RestaurantSettingsLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const qaOpsFixture = getQaOpsAuthFixture({
    cookieValue: cookieStore.get(QA_OPS_AUTH_COOKIE_NAME)?.value,
    host: headerStore.get('host'),
  });

  const opsEnvBanner = resolveOpsEnvBanner();

  if (qaOpsFixture) {
    return (
      <RestaurantSettingsPageShell envBanner={opsEnvBanner}>{children}</RestaurantSettingsPageShell>
    );
  }

  const supabase = await getServerComponentSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error('[settings/restaurant] failed to resolve auth', error.message);
  }

  if (!user) {
    const redirectedFrom = sanitizeAppRequestPath(
      headerStore.get(APP_REQUEST_PATH_HEADER),
      DEFAULT_SETTINGS_REDIRECT_FROM,
    );
    redirect(withRedirectedFrom('/app/auth/signin', redirectedFrom));
  }

  const memberships = await fetchUserMembershipsCached(user.id);
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

  return (
    <RestaurantSettingsPageShell envBanner={opsEnvBanner}>{children}</RestaurantSettingsPageShell>
  );
}
