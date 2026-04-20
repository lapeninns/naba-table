'use client';

import { Beer, UtensilsCrossed } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';

import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import { Button } from '@/components/ui/button';
import { useOpsActiveMembership, useOpsSession } from '@/contexts/ops-session';

import { DrinkMenuManagementPanel } from './DrinkMenuManagementPanel';
import { FoodMenuManagementPanel } from './FoodMenuManagementPanel';

type CatalogMode = 'food' | 'drinks';

export function OpsMenuManagementClient() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { memberships, activeRestaurantId } = useOpsSession();
  const activeMembership = useOpsActiveMembership();
  const catalogMode = useMemo<CatalogMode>(() => {
    const current = searchParams?.get('catalog');
    return current === 'drinks' ? 'drinks' : 'food';
  }, [searchParams]);

  const setCatalogMode = (nextMode: CatalogMode) => {
    if (!pathname) {
      return;
    }
    const nextQuery = new URLSearchParams(searchParams?.toString() ?? '');
    nextQuery.set('catalog', nextMode);
    router.replace(`${pathname}?${nextQuery.toString()}`, { scroll: false });
  };

  const restaurantId =
    activeMembership?.restaurantId ??
    memberships.find((membership) => membership.restaurantId === activeRestaurantId)?.restaurantId ??
    memberships[0]?.restaurantId ??
    null;

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
    <section className="space-y-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Menu catalog">
        <Button
          type="button"
          role="tab"
          aria-selected={catalogMode === 'food'}
          variant={catalogMode === 'food' ? 'default' : 'outline'}
          onClick={() => setCatalogMode('food')}
        >
          <UtensilsCrossed className="mr-2 h-4 w-4" />
          Food menu
        </Button>
        <Button
          type="button"
          role="tab"
          aria-selected={catalogMode === 'drinks'}
          variant={catalogMode === 'drinks' ? 'default' : 'outline'}
          onClick={() => setCatalogMode('drinks')}
        >
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
  );
}
