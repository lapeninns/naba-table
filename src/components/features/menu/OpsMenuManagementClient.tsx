'use client';

import { Beer, LayoutGrid, ShoppingBasket, UtensilsCrossed } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import { RestaurantSettingsCommandCenter } from '@/components/features/restaurant-settings/shared';
import { Button } from '@/components/ui/button';
import { useOpsActiveMembership, useOpsSession } from '@/contexts/ops-session';
import { opsHref } from '@/lib/url/opsHref';
import { cn } from '@/lib/utils';

import { MenuHierarchyManagementPanel } from './MenuHierarchyManagementPanel';

type CatalogMode = 'food' | 'drinks';

const MENU_SETTINGS_HREF = opsHref('/settings/restaurant/menu');

export function OpsMenuManagementClient() {
  const router = useRouter();
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
  const selectCatalogue = useCallback(
    (href: string) => {
      router.push(href);
    },
    [router],
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
    <RestaurantSettingsCommandCenter
      eyebrow="Menu command center"
      title="Menu"
      description="Manage food and drinks menus, sections, items, options, availability, and Google-compatible publishing fields from one workspace."
      metrics={[
        {
          label: 'Catalogue',
          value: catalogMode === 'food' ? 'Food menu' : 'Drinks & bar',
          description: 'active workspace',
          variant: 'secondary',
          Icon: catalogMode === 'food' ? UtensilsCrossed : Beer,
        },
        {
          label: 'Publishing fields',
          value: 'Google-ready',
          description: 'labels, media, nutrition, and modifiers',
          variant: 'outline',
          Icon: ShoppingBasket,
        },
        {
          label: 'Structure',
          value: 'Menus / sections / items',
          description: 'ordered hierarchy',
          variant: 'metric',
          Icon: LayoutGrid,
        },
      ]}
      railTitle="Menu catalogues"
      railDescription="Switch between food and drinks without leaving restaurant settings."
      railItems={catalogues.map((catalogue) => ({
        label: catalogue.label,
        description:
          catalogue.label === 'Food Menu'
            ? 'Dishes, sections, options, dietary and Google food-menu fields.'
            : 'Drinks, bar service fields, ABV, regions, and availability.',
        Icon: catalogue.Icon,
        isActive: catalogue.isActive,
        onSelect: () => selectCatalogue(catalogue.href),
      }))}
      footer="Menu changes keep using the existing menu hierarchy editor and save contracts."
    >
      <div className="flex min-w-0 flex-col gap-4">
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
                  'h-10 min-w-36 justify-center gap-2 rounded-md px-4 text-sm font-semibold text-muted-foreground motion-safe:active:scale-[0.98]',
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
        <section className="min-w-0 rounded-xl border border-border/70 bg-card p-3 shadow-sm">
          <MenuHierarchyManagementPanel
            restaurantId={restaurantId}
            preferredMenuKind={catalogMode}
          />
        </section>
      </div>
    </RestaurantSettingsCommandCenter>
  );
}
