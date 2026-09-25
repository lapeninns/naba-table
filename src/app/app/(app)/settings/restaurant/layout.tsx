import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { RestaurantSettingsPageShell } from '@/components/features/restaurant-settings/RestaurantSettingsPageShell';
import {
  OPS_ACTIVE_RESTAURANT_COOKIE_NAME,
  resolvePreferredOpsRestaurantId,
} from '@/lib/ops/session';
import { isRestaurantAdminRole } from '@/lib/owner/auth/roles';
import { APP_REQUEST_PATH_HEADER, sanitizeAppRequestPath } from '@/lib/url/app-request-path';
import { withRedirectedFrom } from '@/lib/url/withRedirectedFrom';
import { QA_OPS_AUTH_COOKIE_NAME, getQaOpsAuthFixture } from '@/server/auth/qa-ops-session';
import { getRequestUser } from '@/server/auth/request-user';
import { resolveOpsEnvBanner } from '@/server/ops/resolve-ops-env-banner';
import { fetchUserMembershipsCached } from '@/server/team/access';

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

  // Shared with the parent `/app` layout via React cache(): one getUser per request.
  const { user, error } = await getRequestUser();

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

  // Authorize from the membership rows (roles included) already fetched for this
  // user. `activeRestaurantId` is always one of the user's own memberships, so a
  // forged active-restaurant cookie cannot select another tenant. Settings API
  // routes keep their own uncached admin guards for every read and write.
  const activeMembership = memberships.find(
    (membership) => membership.restaurant_id === activeRestaurantId,
  );

  if (!activeMembership || !isRestaurantAdminRole(activeMembership.role)) {
    console.warn('[settings/restaurant] denied non-admin settings access', {
      userId: user.id,
      restaurantId: activeRestaurantId,
      role: activeMembership?.role ?? null,
    });
    redirect('/app/bookings');
  }

  return (
    <RestaurantSettingsPageShell envBanner={opsEnvBanner}>{children}</RestaurantSettingsPageShell>
  );
}
