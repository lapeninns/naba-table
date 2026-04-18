'use client';

import { Beer, UtensilsCrossed } from 'lucide-react';
import { useState } from 'react';

import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import { OpsPageHeader } from '@/components/features/ops-shell/patterns/OpsPageHeader';
import { Button } from '@/components/ui/button';
import { useOpsActiveMembership, useOpsSession } from '@/contexts/ops-session';

import { DrinkMenuManagementPanel } from './DrinkMenuManagementPanel';
import { FoodMenuManagementPanel } from './FoodMenuManagementPanel';

type CatalogMode = 'food' | 'drinks';

export function OpsMenuManagementClient() {
  const { memberships, activeRestaurantId } = useOpsSession();
  const activeMembership = useOpsActiveMembership();
  const [catalogMode, setCatalogMode] = useState<CatalogMode>('food');

  const restaurantId =
    activeMembership?.restaurantId ??
    memberships.find((membership) => membership.restaurantId === activeRestaurantId)?.restaurantId ??
    memberships[0]?.restaurantId ??
    null;

  const restaurantName =
    activeMembership?.restaurantName ??
    memberships.find((membership) => membership.restaurantId === activeRestaurantId)?.restaurantName ??
    memberships[0]?.restaurantName ??
    'Selected restaurant';

  if (memberships.length === 0) {
    return (
      <section className="mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center p-8">
        <OpsEmptyState
          title="No restaurant access"
          description="You need access to at least one restaurant to manage menu settings."
        />
      </section>
    );
  }

  return (
    <main className="space-y-6">
      <OpsPageHeader
        title="Menu"
        subtitle="Manage both food and drink menus, nested modifiers, and spreadsheet imports."
        meta={
          <span className="text-xs text-muted-foreground">
            Currently editing menu data for <span className="font-medium text-foreground">{restaurantName}</span>.
          </span>
        }
        headingLevel="h2"
        titleClassName="text-2xl"
      />

      <section className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant={catalogMode === 'food' ? 'default' : 'outline'} onClick={() => setCatalogMode('food')}>
            <UtensilsCrossed className="mr-2 h-4 w-4" />
            Food menu
          </Button>
          <Button type="button" variant={catalogMode === 'drinks' ? 'default' : 'outline'} onClick={() => setCatalogMode('drinks')}>
            <Beer className="mr-2 h-4 w-4" />
            Drinks menu
          </Button>
        </div>

        {catalogMode === 'food' ? (
          <FoodMenuManagementPanel restaurantId={restaurantId} />
        ) : (
          <DrinkMenuManagementPanel restaurantId={restaurantId} />
        )}
      </section>
    </main>
  );
}
