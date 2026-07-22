'use client';

import { Beer, LayoutGrid, ShoppingBasket, UtensilsCrossed } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import {
  GbpDriftBadge,
  useWorkspaceGbpDriftCheck,
} from '@/components/features/restaurant-settings/gbpDriftBadges';
import {
  useGbpDriftSectionStatus,
  useGbpDriftStatus,
} from '@/components/features/restaurant-settings/GbpDriftProvider';
import { RestaurantSettingsCommandCenter } from '@/components/features/restaurant-settings/shared';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/typography';
import { useOpsActiveMembership, useOpsSession } from '@/contexts/ops-session';
import { opsHref } from '@/lib/url/opsHref';
import { cn } from '@/lib/utils';

import { MenuHierarchyManagementPanel } from './MenuHierarchyManagementPanel';

type CatalogMode = 'food' | 'drinks';

const MENU_SETTINGS_HREF = opsHref('/settings/restaurant/menu');
const MENU_DRIFT_SECTIONS = ['foodMenus'] as const;

export function OpsMenuManagementClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { memberships, activeRestaurantId } = useOpsSession();
  const activeMembership = useOpsActiveMembership();
  const { status: gbpStatus, reviewHref } = useGbpDriftStatus();
  const menuGbpStatus = useGbpDriftSectionStatus('foodMenus');
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
  const gbpDrift = useWorkspaceGbpDriftCheck({
    restaurantId,
    sectionKeys: MENU_DRIFT_SECTIONS,
  });
  const foodMenuDriftFields = gbpDrift.getFieldsBySection('foodMenus');
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
  const menuReviewCount = menuGbpStatus.needsReviewCount;
  return (
    <RestaurantSettingsCommandCenter
      eyebrow="Menu command center"
      title="Menu"
      description="Manage food and drinks menus, sections, items, options, availability, and details that can be published to Google."
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
          value:
            menuReviewCount > 0
              ? `${menuReviewCount} GBP review${menuReviewCount === 1 ? '' : 's'}`
              : gbpStatus.kind === 'not_connected'
                ? 'Google not linked'
                : 'Ready for Google',
          description:
            menuReviewCount > 0
              ? 'review menu drift in GBP workspace'
              : 'labels, media, nutrition, and modifiers',
          variant: menuReviewCount > 0 ? 'metric' : 'outline',
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
      railClassName="hidden lg:block"
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
      footer={
        <span>
          Google menu publishing is configured here; connection and field review live on{' '}
          <Link href={reviewHref} className="underline">
            Google Business Profile
          </Link>
          {menuReviewCount > 0
            ? `, with ${menuReviewCount} menu item${menuReviewCount === 1 ? '' : 's'} waiting.`
            : '.'}
        </span>
      }
    >
      <div className="flex min-w-0 flex-col gap-4">
        <nav
          aria-label="Menu catalogues"
          className="inline-flex w-fit max-w-full rounded-lg border border-border/70 bg-background p-1 shadow-sm lg:hidden"
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
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
            <Text variant="caption">
              Google FoodMenus drift appears beside matching rows below.
            </Text>
            <GbpDriftBadge fields={foodMenuDriftFields} label="Google menu review" />
          </div>
          <MenuHierarchyManagementPanel
            restaurantId={restaurantId}
            preferredMenuKind={catalogMode}
            gbpDriftFields={foodMenuDriftFields}
          />
        </section>
      </div>
    </RestaurantSettingsCommandCenter>
  );
}
