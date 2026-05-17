'use client';

import { motion } from 'motion/react';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { OpsPageHeader } from '@/components/features/ops-shell/patterns/OpsPageHeader';
import { Badge } from '@/components/ui/badge';
import { useOpsActiveMembership, useOpsSession } from '@/contexts/ops-session';
import { normalizeOpsPathname } from '@/lib/url/opsHref';

import { GbpDriftStatusStrip } from './gbp-drift/GbpDriftStatusStrip';
import { GbpDriftProvider, GbpDriftStatusPill } from './GbpDriftProvider';
import { RestaurantSettingsFocusedShell } from './RestaurantSettingsFocusedShell';
import { getRestaurantSettingsRouteCopy } from './routes';

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
  envBanner?: string | null;
};

const DEFAULT_TITLE = 'Restaurant';
const DEFAULT_DESCRIPTION =
  'Configure the restaurant profile, availability, reservation durations, menu, tables, and team access.';

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!mediaQuery) {
      return;
    }
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener?.('change', handleChange);
    return () => mediaQuery.removeEventListener?.('change', handleChange);
  }, []);

  return prefersReducedMotion;
}

function RestaurantSettingsPageHeading({
  title,
  description,
  eyebrow,
}: Pick<RestaurantSettingsPageShellProps, 'title' | 'description' | 'eyebrow'>) {
  const pathname = usePathname();
  const { memberships, activeRestaurantId } = useOpsSession();
  const activeMembership = useOpsActiveMembership();

  const activeNavItem = useMemo(() => {
    if (!pathname) return null;
    const normalized = normalizeOpsPathname(pathname);
    return getRestaurantSettingsRouteCopy(normalized);
  }, [pathname]);

  const resolvedTitle = title ?? activeNavItem?.title ?? DEFAULT_TITLE;
  const resolvedDescription = description ?? activeNavItem?.description ?? DEFAULT_DESCRIPTION;

  const restaurantName =
    activeMembership?.restaurantName ??
    memberships.find((membership) => membership.restaurantId === activeRestaurantId)
      ?.restaurantName ??
    memberships[0]?.restaurantName ??
    null;

  return (
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
            <GbpDriftStatusPill />
          </span>
        ) : null
      }
      headingLevel="h1"
      titleClassName="text-2xl"
      className="mb-6"
    />
  );
}

export function RestaurantSettingsPageShell({
  title,
  description,
  eyebrow = 'Settings',
  children,
  envBanner,
}: RestaurantSettingsPageShellProps) {
  const reduceMotion = usePrefersReducedMotion();

  return (
    <GbpDriftProvider>
      <RestaurantSettingsFocusedShell envBanner={envBanner}>
        <RestaurantSettingsPageHeading title={title} description={description} eyebrow={eyebrow} />
        <GbpDriftStatusStrip />
        <motion.div
          initial={reduceMotion ? false : { y: 8, opacity: 0 }}
          animate={reduceMotion ? undefined : { y: 0, opacity: 1 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          {children}
        </motion.div>
      </RestaurantSettingsFocusedShell>
    </GbpDriftProvider>
  );
}
