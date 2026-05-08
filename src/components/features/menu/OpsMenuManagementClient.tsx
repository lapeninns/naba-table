'use client';

import {
  Beer,
  ClipboardList,
  Database,
  LayoutGrid,
  Layers,
  UtensilsCrossed,
} from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';

import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import { RestaurantSettingsCommandCenter } from '@/components/features/restaurant-settings/shared';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useOpsActiveMembership, useOpsSession } from '@/contexts/ops-session';
import { useOpsMenuHierarchy } from '@/hooks/ops/useOpsMenuHierarchy';
import { opsHref } from '@/lib/url/opsHref';

import { DrinkMenuManagementPanel } from './DrinkMenuManagementPanel';
import { FoodMenuManagementPanel } from './FoodMenuManagementPanel';
import { MenuHierarchyManagementPanel } from './MenuHierarchyManagementPanel';

import type { MenuKind } from '@/server/menu-hierarchy/types';

type CatalogMode = 'food' | 'drinks';

const MENU_SETTINGS_HREF = opsHref('/settings/restaurant/menu');

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

  const [preferredMenuKind, setPreferredMenuKind] = useState<Extract<MenuKind, 'food' | 'drinks'>>(
    catalogMode,
  );

  const setCatalogMode = useCallback(
    (nextMode: CatalogMode) => {
      if (!pathname) {
        return;
      }
      const nextQuery = new URLSearchParams(searchParams?.toString() ?? '');
      nextQuery.set('catalog', nextMode);
      router.replace(`${pathname}?${nextQuery.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const handlePreferredMenuKindChange = useCallback(
    (kind: Extract<MenuKind, 'food' | 'drinks'>) => {
      setPreferredMenuKind(kind);
      if (kind !== catalogMode) {
        setCatalogMode(kind);
      }
    },
    [catalogMode, setCatalogMode],
  );

  const restaurantId = useMemo(
    () =>
      activeMembership?.restaurantId ??
      memberships.find((membership) => membership.restaurantId === activeRestaurantId)
        ?.restaurantId ??
      memberships[0]?.restaurantId ??
      null,
    [activeMembership?.restaurantId, activeRestaurantId, memberships],
  );

  const hierarchyQuery = useOpsMenuHierarchy(restaurantId);
  const menus = hierarchyQuery.data?.menus ?? [];
  const menuCount = menus.length;
  const sectionCount = menus.reduce((acc, m) => acc + m.sections.length, 0);
  const itemCount = menus.reduce(
    (acc, m) => acc + m.sections.reduce((s, sec) => s + sec.items.length, 0),
    0,
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

  return (
    <RestaurantSettingsCommandCenter
      eyebrow="Menu command center"
      title="Menu"
      description="Canonical menu workspace — manage menus, sections, items, and options using the Google-compatible hierarchy."
      metrics={[
        {
          label: 'Active catalogue',
          value: preferredMenuKind === 'food' ? 'Food menu' : 'Drinks menu',
          description: 'preferred view',
          variant: 'secondary',
          Icon: LayoutGrid,
        },
        {
          label: 'Menus',
          value: String(menuCount),
          description: `${sectionCount} sections`,
          variant: 'outline',
          Icon: Layers,
        },
        {
          label: 'Items',
          value: String(itemCount),
          description: 'across all menus',
          variant: 'outline',
          Icon: ClipboardList,
        },
      ]}
      railTitle="Menu catalogues"
      railDescription="Switch between food and drinks views within the canonical workspace."
      railItems={[
        {
          label: 'Food menu',
          description: 'Dishes, categories, pricing, availability, allergens, and modifiers.',
          href: `${MENU_SETTINGS_HREF}?catalog=food`,
          Icon: UtensilsCrossed,
          badge: catalogMode === 'food' ? 'Open' : undefined,
          isActive: catalogMode === 'food',
        },
        {
          label: 'Drinks menu',
          description: 'Drinks, serves, ABV, availability, pairing cues, and modifiers.',
          href: `${MENU_SETTINGS_HREF}?catalog=drinks`,
          Icon: Beer,
          badge: catalogMode === 'drinks' ? 'Open' : undefined,
          isActive: catalogMode === 'drinks',
        },
      ]}
      footer="The canonical workspace replaces the legacy item-first panels. Legacy panels remain available below for reference and import."
    >
      {/* Primary canonical workspace */}
      <MenuHierarchyManagementPanel
        restaurantId={restaurantId}
        preferredMenuKind={preferredMenuKind}
        onPreferredMenuKindChange={handlePreferredMenuKindChange}
      />

      {/* Legacy v1 panels — secondary/read-only support */}
      <Accordion type="single" collapsible className="mt-2">
        <AccordionItem value="legacy-panels" className="rounded-lg border border-border/70 shadow-sm">
          <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline">
            <span className="flex items-center gap-2">
              <Database className="size-4 text-muted-foreground" aria-hidden />
              Legacy item panels (v1 compatibility)
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <p className="mb-4 text-xs text-muted-foreground">
              These panels use the original item-first API. Use them for CSV imports and
              quick-reference only — the canonical workspace above is the primary editor.
            </p>
            <div className="flex flex-col gap-4">
              {catalogMode === 'food' ? (
                <FoodMenuManagementPanel restaurantId={restaurantId} />
              ) : (
                <DrinkMenuManagementPanel restaurantId={restaurantId} />
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </RestaurantSettingsCommandCenter>
  );
}
