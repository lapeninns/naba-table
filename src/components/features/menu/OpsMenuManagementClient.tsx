'use client';

import { Info } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';

import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import { useWorkspaceGbpDriftCheck } from '@/components/features/restaurant-settings/gbpDriftBadges';
import { useGbpDriftStatus } from '@/components/features/restaurant-settings/GbpDriftProvider';
import { RESTAURANT_SETTINGS_ROUTE_MAP } from '@/components/features/restaurant-settings/routes';
import { RestaurantSettingsCommandCenter } from '@/components/features/restaurant-settings/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useOpsActiveMembership, useOpsSession } from '@/contexts/ops-session';
import { opsHref } from '@/lib/url/opsHref';
import { cn } from '@/lib/utils';

import { MenuHierarchyManagementPanel } from './MenuHierarchyManagementPanel';

type CatalogMode = 'food' | 'drinks';

const MENU_ROUTE = RESTAURANT_SETTINGS_ROUTE_MAP.menu;
const MENU_SETTINGS_HREF = opsHref('/settings/restaurant/menu');
const MENU_DRIFT_SECTIONS = ['foodMenus'] as const;

const CATALOGUES: ReadonlyArray<{ mode: CatalogMode; label: string }> = [
  { mode: 'food', label: 'Food menus' },
  { mode: 'drinks', label: 'Drinks and bar' },
];

function CatalogueSwitch({ catalogMode }: { readonly catalogMode: CatalogMode }) {
  return (
    <nav aria-label="Menu catalogues" className="min-w-0">
      <ul className="inline-flex max-w-full flex-wrap gap-1 rounded-lg border border-border/70 bg-background p-1">
        {CATALOGUES.map((catalogue) => {
          const isActive = catalogue.mode === catalogMode;
          return (
            <li key={catalogue.mode}>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className={cn(
                  'text-muted-foreground [@media(pointer:coarse)]:min-h-11',
                  isActive && 'bg-muted font-semibold text-foreground',
                )}
              >
                <Link
                  href={`${MENU_SETTINGS_HREF}?catalog=${catalogue.mode}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {catalogue.label}
                </Link>
              </Button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Shown only while some menu items differ from what Google shows. */
function GoogleMenuDriftNote({
  count,
  reviewHref,
}: {
  readonly count: number;
  readonly reviewHref: string;
}) {
  if (count <= 0) return null;
  return (
    <Alert variant="info" role="note" data-testid="menu-google-note">
      <Info aria-hidden />
      <AlertDescription className="flex flex-col gap-1">
        <p>
          <span className="font-semibold tabular-nums">
            {count === 1 ? '1 item differs' : `${count} items differ`} from what Google shows.
          </span>{' '}
          Publishing a menu to Google replaces Google’s whole menu.
        </p>
        <p className="text-muted-foreground">
          Review and publish on{' '}
          <Link href={reviewHref} className="font-medium text-foreground underline">
            Google Business Profile
          </Link>
          .
        </p>
      </AlertDescription>
    </Alert>
  );
}

export function OpsMenuManagementClient() {
  const searchParams = useSearchParams();
  const { memberships, activeRestaurantId } = useOpsSession();
  const activeMembership = useOpsActiveMembership();
  const { reviewHref } = useGbpDriftStatus();
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
    <RestaurantSettingsCommandCenter title={MENU_ROUTE.title} description={MENU_ROUTE.description}>
      <MenuHierarchyManagementPanel
        restaurantId={restaurantId}
        preferredMenuKind={catalogMode}
        gbpDriftFields={foodMenuDriftFields}
        catalogueSwitch={<CatalogueSwitch catalogMode={catalogMode} />}
        notice={<GoogleMenuDriftNote count={foodMenuDriftFields.length} reviewHref={reviewHref} />}
      />
    </RestaurantSettingsCommandCenter>
  );
}
