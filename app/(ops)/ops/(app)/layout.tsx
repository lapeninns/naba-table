import type { ReactNode } from "react";
import { cookies } from "next/headers";

import { OpsAppShell } from "@/components/ops/OpsAppShell";
import type { OpsSidebarAccount } from "@/components/ops/AppSidebar";
import { isRestaurantRole } from "@/lib/owner/auth/roles";
import { fetchUserMemberships } from "@/server/team/access";
import { getServerComponentSupabaseClient } from "@/server/supabase";

type OpsAppLayoutProps = {
  children: ReactNode;
};

export default async function OpsAppLayout({ children }: OpsAppLayoutProps) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";

  const supabase = await getServerComponentSupabaseClient();
  let account: OpsSidebarAccount | null = null;

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      console.error("[ops/layout] failed to load user", error.message);
    }

    if (user) {
      try {
        const memberships = await fetchUserMemberships(user.id, supabase);
        const primaryMembership = memberships[0] ?? null;
        const role = primaryMembership?.role && isRestaurantRole(primaryMembership.role) ? primaryMembership.role : null;

        account = {
          restaurantName: primaryMembership?.restaurants?.name ?? null,
          userEmail: user.email ?? null,
          role,
        };
      } catch (membershipError) {
        console.error("[ops/layout] failed to load memberships", membershipError);
        account = {
          restaurantName: null,
          userEmail: user.email ?? null,
          role: null,
        };
      }
    }
  } catch (authError) {
    console.error("[ops/layout] unexpected error while resolving account", authError);
  }

  return (
    <OpsAppShell defaultOpen={defaultOpen} account={account}>
      {children}
    </OpsAppShell>
  );
}
