/**
 * Table Inventory Management Page
 * Story 4: Ops Dashboard - Tables UI
 */

import { redirect } from "next/navigation";
import { Suspense } from "react";

import { RestaurantSettingsPageShell } from "@/components/features/restaurant-settings/RestaurantSettingsPageShell";
import TableInventoryClient from "@/components/features/tables/TableInventoryClient";
import { withRedirectedFrom } from "@/lib/url/withRedirectedFrom";
import { getServerComponentSupabaseClient } from "@/server/supabase";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Table Inventory | Operations",
  description: "Manage restaurant table inventory and floor plan",
};

export default async function TablesPage() {
  const supabase = await getServerComponentSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error("[ops/tables] failed to resolve auth", error.message);
  }

  if (!user) {
    redirect(withRedirectedFrom('/app/auth/signin', '/app/settings/tables'));
  }

  return (
    <RestaurantSettingsPageShell
      title="Tables"
      description="Configure seating resources, capacity assumptions, and service zones for your restaurant."
    >
      <Suspense fallback={<div className="flex items-center justify-center p-12">Loading tables...</div>}>
        <TableInventoryClient />
      </Suspense>
    </RestaurantSettingsPageShell>
  );
}
