'use client';

import { Suspense, useMemo } from 'react';

import { RestaurantSettingsPageShell } from '@/components/features/restaurant-settings/RestaurantSettingsPageShell';
import TableInventoryClient from '@/components/features/tables/TableInventoryClient';
import { Card } from '@/components/ui/card';

import { createOpsDevServiceFactories } from '../../_mocks/services/devFactories';
import { OpsDevProviders } from '../../_shared/OpsDevProviders';

export function OpsTablesSettingsDevHarness() {
  const factories = useMemo(() => createOpsDevServiceFactories(), []);

  return (
    <OpsDevProviders factories={factories}>
      <RestaurantSettingsPageShell
        title="Tables"
        description="Dev harness for table inventory list + dialog layout at small widths."
        eyebrow="Dev"
      >
        <Suspense
          fallback={
            <Card className="p-8 text-center text-sm text-muted-foreground">Loading tables…</Card>
          }
        >
          <TableInventoryClient />
        </Suspense>
      </RestaurantSettingsPageShell>
    </OpsDevProviders>
  );
}

