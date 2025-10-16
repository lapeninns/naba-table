/**
 * Capacity Configuration Page
 * Story 5: Ops Dashboard - Capacity Management
 */

import { Suspense } from "react";
import { Metadata } from "next";
import CapacityConfigClient from "@/components/features/capacity/CapacityConfigClient";
import { isCapacityAdminDashboardEnabled } from "@/server/feature-flags";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const metadata: Metadata = {
  title: "Capacity Management | Operations",
  description: "Configure restaurant capacity rules and view real-time utilization",
};

export default function CapacityPage() {
  const isEnabled = isCapacityAdminDashboardEnabled();

  if (!isEnabled) {
    return (
      <div className="container mx-auto py-12">
        <Alert>
          <AlertTitle>Capacity admin dashboard disabled</AlertTitle>
          <AlertDescription>
            Enable the <code>FEATURE_CAPACITY_ADMIN_DASHBOARD</code> flag to access advanced capacity controls.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Capacity Management</h1>
          <p className="text-muted-foreground">
            Configure capacity limits and monitor real-time utilization
          </p>
        </div>
      </div>

      <Suspense fallback={<div className="flex items-center justify-center p-12">Loading capacity data...</div>}>
        <CapacityConfigClient />
      </Suspense>
    </div>
  );
}
