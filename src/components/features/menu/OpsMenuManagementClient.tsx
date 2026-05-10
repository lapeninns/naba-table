'use client';

import { Beer, UtensilsCrossed } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';

import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import { Button } from '@/components/ui/button';
import { useOpsActiveMembership, useOpsSession } from '@/contexts/ops-session';
import { opsHref } from '@/lib/url/opsHref';
import { cn } from '@/lib/utils';

import { MenuHierarchyManagementPanel } from './MenuHierarchyManagementPanel';

type CatalogMode = 'food' | 'drinks';

const MENU_SETTINGS_HREF = opsHref('/settings/restaurant/menu');

export function OpsMenuManagementClient() {
  const searchParams = useSearchParams();
  const { memberships, activeRestaurantId } = useOpsSession();
  const activeMembership = useOpsActiveMembership();
  const catalogMode = useMemo<CatalogMode>(() => {
    const current = searchParams?.get('catalog');
    return current === 'drinks' ? 'drinks' : 'food';
  }, [searchParams]);

  const restaurantId = useMemo(
    () =>
      activeMembership?.restaurantId ??
      memberships.find((membership) => membership.restaurantId === activeRestaurantId)
        ?.restaurantId ??
      memberships[0]?.restaurantId ??
      null,
    [activeMembership?.restaurantId, activeRestaurantId, memberships],
  );

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

  const catalogues = [
    {
      label: 'Food Menu',
      href: `${MENU_SETTINGS_HREF}?catalog=food`,
      isActive: catalogMode === 'food',
      Icon: UtensilsCrossed,
    },
    {
      label: 'Drinks & Bar',
      href: `${MENU_SETTINGS_HREF}?catalog=drinks`,
      isActive: catalogMode === 'drinks',
      Icon: Beer,
    },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <nav
        aria-label="Menu catalogues"
        className="inline-flex w-fit max-w-full rounded-lg border border-border/70 bg-background p-1 shadow-sm"
      >
        {catalogues.map((catalogue) => {
          const Icon = catalogue.Icon;
          return (
            <Button
              key={catalogue.href}
              asChild
              variant="ghost"
              aria-current={catalogue.isActive ? 'page' : undefined}
              className={cn(
                'h-12 min-w-40 justify-center gap-2 rounded-md px-4 text-base font-semibold text-muted-foreground active:scale-[0.96]',
                catalogue.isActive && 'bg-muted text-foreground shadow-sm',
              )}
            >
              <Link href={catalogue.href}>
                <Icon data-icon="inline-start" aria-hidden />
                {catalogue.label}
              </Link>
            </Button>
          );
        })}
      </nav>
      <MenuHierarchyManagementPanel restaurantId={restaurantId} preferredMenuKind={catalogMode} />
    </div>
  );
}
