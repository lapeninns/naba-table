/**
 * Table Inventory Management Page
 * Story 4: Ops Dashboard - Tables UI
 */

import { redirect } from "next/navigation";
import { Suspense } from "react";

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
    redirect(withRedirectedFrom('/login', '/tables'));
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Table Settings</h1>
          <p className="text-muted-foreground">
            Configure seating resources, capacity assumptions, and service zones for your restaurant.
          </p>
        </div>
      </div>

      <Suspense fallback={<div className="flex items-center justify-center p-12">Loading tables...</div>}>
        <TableInventoryClient />
      </Suspense>
    </div>
  );
}
