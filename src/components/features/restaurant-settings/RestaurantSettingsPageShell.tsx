'use client';

import { motion } from 'motion/react';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { OpsPageHeader } from '@/components/features/ops-shell/patterns/OpsPageHeader';
import { useOpsActiveMembership, useOpsSession } from '@/contexts/ops-session';

import { GbpDriftStatusStrip } from './gbp-drift/GbpDriftStatusStrip';
import { GbpDriftProvider, GbpDriftStatusPill } from './GbpDriftProvider';
import { RestaurantSettingsFocusedShell } from './RestaurantSettingsFocusedShell';
import { getRestaurantSettingsHeadingContext } from './restaurantSettingsHeading';

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

  const headingContext = useMemo(() => {
    if (!pathname) return null;
    return getRestaurantSettingsHeadingContext(pathname);
  }, [pathname]);

  const useExplicitOverrides = title != null || description != null;
  const resolvedTitle = title ?? headingContext?.pageTitle ?? DEFAULT_TITLE;
  const resolvedDescription =
    description ?? headingContext?.pageDescription ?? DEFAULT_DESCRIPTION;
  const suppressVisiblePageTitle =
    !useExplicitOverrides && (headingContext?.suppressVisiblePageTitle ?? false);
  const hidePageIntro =
    !useExplicitOverrides && (headingContext?.hidePageIntro ?? false);
  const showRestaurantMetaOnPage =
    useExplicitOverrides || (headingContext?.showRestaurantMetaOnPage ?? true);

  if (hidePageIntro) {
    return null;
  }

  const restaurantName =
    activeMembership?.restaurantName ??
    memberships.find((membership) => membership.restaurantId === activeRestaurantId)
      ?.restaurantName ??
    memberships[0]?.restaurantName ??
    null;

  if (suppressVisiblePageTitle) {
    return (
      <header className="mb-6 flex flex-col gap-3">
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
          {resolvedDescription}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <GbpDriftStatusPill />
        </div>
      </header>
    );
  }

  return (
    <OpsPageHeader
      eyebrow={eyebrow}
      title={resolvedTitle}
      subtitle={resolvedDescription}
      meta={
        showRestaurantMetaOnPage && restaurantName ? (
          <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Editing</span>
            <span className="font-medium text-foreground">{restaurantName}</span>
            <GbpDriftStatusPill />
          </span>
        ) : (
          <GbpDriftStatusPill />
        )
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
  const pathname = usePathname();
  const reduceMotion = usePrefersReducedMotion();
  const hidePageIntro = useMemo(() => {
    if (!pathname) return false;
    if (title != null || description != null) return false;
    return getRestaurantSettingsHeadingContext(pathname).hidePageIntro;
  }, [description, pathname, title]);

  return (
    <GbpDriftProvider>
      <RestaurantSettingsFocusedShell envBanner={envBanner}>
        <RestaurantSettingsPageHeading title={title} description={description} eyebrow={eyebrow} />
        <GbpDriftStatusStrip compact={hidePageIntro} />
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
