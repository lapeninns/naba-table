import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { AppProviders } from '@/app/providers';
import { OpsShell } from '@/components/features/ops-shell/OpsShell';
import { OpsServicesProvider } from '@/contexts/ops-services';
import { OpsSessionProvider } from '@/contexts/ops-session';
import {
  OPS_ACTIVE_RESTAURANT_COOKIE_NAME,
  resolvePreferredOpsRestaurantId,
} from '@/lib/ops/session';
import { QA_OPS_AUTH_COOKIE_NAME, getQaOpsAuthFixture } from '@/server/auth/qa-ops-session';
import { getRequestUser } from '@/server/auth/request-user';
import { resolveOpsEnvBanner } from '@/server/ops/resolve-ops-env-banner';
import {
  fetchUserMembershipsCached,
  type RestaurantMembershipWithDetails,
} from '@/server/team/access';

import type { RestaurantRole } from '@/lib/owner/auth/roles';
import type { OpsMembership, OpsUser } from '@/types/ops';
import type { ReactNode } from 'react';

type OpsAppLayoutProps = {
  children: ReactNode;
};

export const dynamic = 'force-dynamic';

function describeSupabaseError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return { message: String(error) };
  }

  const maybe = error as {
    code?: string;
    message?: string;
    details?: string | null;
    hint?: string | null;
  };

  return {
    code: maybe.code ?? null,
    message: maybe.message ?? String(error),
    details: maybe.details ?? null,
    hint: maybe.hint ?? null,
  };
}

function mapMembershipToOps(membership: RestaurantMembershipWithDetails): OpsMembership {
  return {
    restaurantId: membership.restaurant_id,
    restaurantName: membership.restaurants?.name ?? 'Restaurant',
    restaurantSlug: membership.restaurants?.slug ?? null,
    role: membership.role as RestaurantRole,
    createdAt: membership.created_at ?? null,
  };
}

export default async function OpsAppLayout({ children }: OpsAppLayoutProps) {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const defaultOpen = cookieStore.get('sidebar_state')?.value === 'true';
  const qaOpsFixture = getQaOpsAuthFixture({
    cookieValue: cookieStore.get(QA_OPS_AUTH_COOKIE_NAME)?.value,
    host: headerStore.get('host'),
  });

  let supabaseUser: OpsUser | null = null;
  let memberships: RestaurantMembershipWithDetails[] = [];
  let qaOpsMemberships: OpsMembership[] | null = null;

  if (qaOpsFixture) {
    supabaseUser = qaOpsFixture.user;
    qaOpsMemberships = qaOpsFixture.memberships;
  } else {
    try {
      // React cache(): nested layouts (e.g. restaurant settings) reuse this result.
      const { user, error } = await getRequestUser();

      if (error) {
        console.error('[app/layout] failed to load user', error.message);
      }

      if (user) {
        supabaseUser = {
          id: user.id,
          email: user.email ?? null,
        };
      }
    } catch (authError) {
      console.error('[app/layout] unexpected error while resolving account', authError);
    }
  }

  if (supabaseUser && !qaOpsFixture) {
    const membershipsPromise = fetchUserMembershipsCached(supabaseUser.id);

    try {
      memberships = await membershipsPromise;
    } catch (membershipError) {
      console.error(
        '[app/layout] failed to load memberships',
        describeSupabaseError(membershipError),
      );
      memberships = [];
    }
  }

  // Redirect to login if not authenticated
  // All pages under this layout require authentication
  if (!supabaseUser) {
    redirect('/app/auth/signin');
  }

  const opsMemberships: OpsMembership[] =
    qaOpsMemberships ??
    memberships.filter((membership) => Boolean(membership.restaurant_id)).map(mapMembershipToOps);

  const initialRestaurantId = resolvePreferredOpsRestaurantId(
    opsMemberships.map((membership) => membership.restaurantId),
    cookieStore.get(OPS_ACTIVE_RESTAURANT_COOKIE_NAME)?.value ?? null,
  );
  const opsEnvBanner = resolveOpsEnvBanner();

  return (
    <OpsSessionProvider
      user={supabaseUser}
      memberships={opsMemberships}
      initialRestaurantId={initialRestaurantId}
    >
      <OpsServicesProvider>
        <AppProviders>
          <OpsShell defaultSidebarOpen={defaultOpen} envBanner={opsEnvBanner}>
            {children}
          </OpsShell>
        </AppProviders>
      </OpsServicesProvider>
    </OpsSessionProvider>
  );
}
