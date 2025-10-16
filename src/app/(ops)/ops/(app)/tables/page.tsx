/**
 * Table Inventory Management Page
 * Story 4: Ops Dashboard - Tables UI
 */

import { Suspense } from "react";
import { Metadata } from "next";
import TableInventoryClient from "@/components/features/tables/TableInventoryClient";

export const metadata: Metadata = {
  title: "Table Inventory | Operations",
  description: "Manage restaurant table inventory and floor plan",
};

export default function TablesPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Table Inventory</h1>
          <p className="text-muted-foreground">
            Manage your restaurant's table configuration and floor plan
          </p>
        </div>
      </div>

      <Suspense fallback={<div className="flex items-center justify-center p-12">Loading tables...</div>}>
        <TableInventoryClient />
      </Suspense>
    </div>
  );
}
