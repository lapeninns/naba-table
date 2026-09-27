'use client';

import { Info } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';

import { useWorkspaceGbpDriftCheck } from '@/components/features/restaurant-settings/gbpDriftBadges';
import { useGbpDriftStatus } from '@/components/features/restaurant-settings/GbpDriftProvider';
import { SETTINGS_INLINE_LINK_CLASS } from '@/components/features/restaurant-settings/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useOpsActiveMembership, useOpsSession } from '@/contexts/ops-session';
import { opsHref } from '@/lib/url/opsHref';

import { MenuHierarchyManagementPanel } from './MenuHierarchyManagementPanel';

type CatalogMode = 'food' | 'drinks';

const MENU_SETTINGS_HREF = opsHref('/settings/restaurant/menu');
const MENU_DRIFT_SECTIONS = ['foodMenus'] as const;

const CATALOGUES: ReadonlyArray<{ mode: CatalogMode; label: string }> = [
  { mode: 'food', label: 'Food menus' },
  { mode: 'drinks', label: 'Drinks and bar' },
];

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
    <Alert role="note" data-testid="menu-google-note" className="bg-muted/30">
      <Info aria-hidden className="text-muted-foreground" />
      <AlertDescription className="flex flex-col gap-1">
        <p>
          <span className="font-semibold tabular-nums">
            {count === 1 ? '1 item differs' : `${count} items differ`} from what Google shows.
          </span>{' '}
          Publishing a menu to Google replaces Google’s whole menu.
        </p>
        <p className="text-muted-foreground">
          Review and publish on{' '}
          <Link href={reviewHref} className={SETTINGS_INLINE_LINK_CLASS}>
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

  const catalogueRailItems = useMemo(
    () =>
      CATALOGUES.map((catalogue) => ({
        label: catalogue.label,
        href: `${MENU_SETTINGS_HREF}?catalog=${catalogue.mode}`,
        isActive: catalogue.mode === catalogMode,
      })),
    [catalogMode],
  );

  return (
    <MenuHierarchyManagementPanel
      restaurantId={restaurantId}
      preferredMenuKind={catalogMode}
      gbpDriftFields={foodMenuDriftFields}
      catalogueRailItems={catalogueRailItems}
      notice={<GoogleMenuDriftNote count={foodMenuDriftFields.length} reviewHref={reviewHref} />}
    />
  );
}
