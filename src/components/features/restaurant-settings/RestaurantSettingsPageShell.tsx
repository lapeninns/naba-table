'use client';

import { usePathname } from 'next/navigation';
import { useMemo, type ReactNode } from 'react';

import { OpsPageHeader } from '@/components/features/ops-shell/patterns/OpsPageHeader';
import { Badge } from '@/components/ui/badge';
import { useOpsActiveMembership, useOpsSession } from '@/contexts/ops-session';
import { normalizeOpsPathname } from '@/lib/url/opsHref';

import { RestaurantSettingsSubnav } from './RestaurantSettingsSubnav';
import { RESTAURANT_SETTINGS_NAV_ITEMS } from './routes';

export type RestaurantSettingsPageShellProps = {
  /**
   * Override title when rendering outside an authenticated settings route (e.g. dev harness).
   * When omitted, the shell derives the title from the current pathname against the
   * shared restaurant settings navigation metadata.
   */
  title?: string;
  description?: string;
  eyebrow?: string;
  children: ReactNode;
};

const DEFAULT_TITLE = 'Restaurant';
const DEFAULT_DESCRIPTION =
  'Configure the restaurant profile, availability, reservation durations, menu, tables, and team access.';

export function RestaurantSettingsPageShell({
  title,
  description,
  eyebrow = 'Settings',
  children,
}: RestaurantSettingsPageShellProps) {
  const pathname = usePathname();
  const { memberships, activeRestaurantId } = useOpsSession();
  const activeMembership = useOpsActiveMembership();

  const activeNavItem = useMemo(() => {
    if (!pathname) return null;
    const normalized = normalizeOpsPathname(pathname);
    return (
      RESTAURANT_SETTINGS_NAV_ITEMS.find((item) =>
        normalized.startsWith(normalizeOpsPathname(item.href)),
      ) ?? null
    );
  }, [pathname]);

  const resolvedTitle = title ?? activeNavItem?.title ?? DEFAULT_TITLE;
  const resolvedDescription = description ?? activeNavItem?.description ?? DEFAULT_DESCRIPTION;

  const restaurantName =
    activeMembership?.restaurantName ??
    memberships.find((membership) => membership.restaurantId === activeRestaurantId)?.restaurantName ??
    memberships[0]?.restaurantName ??
    null;

  return (
    <main className="mx-auto flex w-full max-w-[80vw] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <OpsPageHeader
        eyebrow={eyebrow}
        title={resolvedTitle}
        subtitle={resolvedDescription}
        meta={
          restaurantName ? (
            <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>Editing</span>
              <Badge variant="outline" className="font-medium text-foreground">
                {restaurantName}
              </Badge>
              <span className="hidden sm:inline">
                Use the sidebar restaurant switcher to change restaurants.
              </span>
            </span>
          ) : null
        }
        headingLevel="h1"
        titleClassName="text-3xl"
      />

      <RestaurantSettingsSubnav />

      <div className="pb-8">{children}</div>
    </main>
  );
}
