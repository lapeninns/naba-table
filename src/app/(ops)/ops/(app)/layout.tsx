import type { ReactNode } from "react";
import { cookies } from "next/headers";

import { OpsShell } from "@/components/features/ops-shell";
import { OpsServicesProvider } from "@/contexts/ops-services";
import { OpsSessionProvider } from "@/contexts/ops-session";
import type { RestaurantRole } from "@/lib/owner/auth/roles";
import { fetchUserMemberships, type RestaurantMembershipWithDetails } from "@/server/team/access";
import { getServerComponentSupabaseClient } from "@/server/supabase";
import type { OpsMembership, OpsUser } from "@/types/ops";
import { env } from "@/lib/env";

type OpsAppLayoutProps = {
  children: ReactNode;
};

function mapMembershipToOps(membership: RestaurantMembershipWithDetails): OpsMembership {
  return {
    restaurantId: membership.restaurant_id,
    restaurantName: membership.restaurants?.name ?? "Restaurant",
    restaurantSlug: membership.restaurants?.slug ?? null,
    role: membership.role as RestaurantRole,
    createdAt: membership.created_at ?? null,
  };
}

export default async function OpsAppLayout({ children }: OpsAppLayoutProps) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";

  const supabase = await getServerComponentSupabaseClient();

  let supabaseUser: OpsUser | null = null;
  let memberships: RestaurantMembershipWithDetails[] = [];

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      console.error("[ops/layout] failed to load user", error.message);
    }

    if (user) {
      supabaseUser = {
        id: user.id,
        email: user.email ?? null,
      };

      try {
        memberships = await fetchUserMemberships(user.id, supabase);
      } catch (membershipError) {
        console.error("[ops/layout] failed to load memberships", membershipError);
        memberships = [];
      }
    }
  } catch (authError) {
    console.error("[ops/layout] unexpected error while resolving account", authError);
  }

  const opsMemberships: OpsMembership[] = memberships
    .filter((membership) => Boolean(membership.restaurant_id))
    .map(mapMembershipToOps);

  const initialRestaurantId = opsMemberships[0]?.restaurantId ?? null;
  const featureFlags = {
    capacityConfig: env.featureFlags.capacityConfig ?? false,
    opsMetrics: env.featureFlags.opsMetrics ?? false,
    selectorScoring: env.featureFlags.selectorScoring ?? false,
  } as const;

  return (
    <OpsSessionProvider
      user={supabaseUser}
      memberships={opsMemberships}
      initialRestaurantId={initialRestaurantId}
      featureFlags={featureFlags}
    >
      <OpsServicesProvider>
        <OpsShell defaultSidebarOpen={defaultOpen}>{children}</OpsShell>
      </OpsServicesProvider>
    </OpsSessionProvider>
  );
}
