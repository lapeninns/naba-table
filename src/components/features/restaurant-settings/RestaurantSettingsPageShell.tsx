'use client';

import { motion } from 'motion/react';
import { useEffect, useState, type ReactNode } from 'react';

import { GbpDriftStatusStrip } from './gbp-drift/GbpDriftStatusStrip';
import { GbpDriftProvider } from './GbpDriftProvider';
import { RestaurantSettingsFocusedShell } from './RestaurantSettingsFocusedShell';
import { useRestaurantSettingsContext } from './shell/useRestaurantSettingsContext';

export type RestaurantSettingsPageShellProps = {
  /**
   * Override title when rendering outside an authenticated settings route (e.g. dev harness).
   * When omitted, the shell derives the title from the current pathname against the
   * shared restaurant settings navigation metadata.
   */
  title?: string;
  description?: string;
  /** @deprecated No longer rendered: the settings chrome breadcrumb carries the location. */
  eyebrow?: string;
  children: ReactNode;
  envBanner?: string | null;
};

const DEFAULT_DESCRIPTION =
  'Configure the restaurant profile, availability, dining durations, menu, tables, and team access.';

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

/**
 * Page purpose line. The settings chrome owns the page title (the only h1), so the page adds
 * just the description, and only when the route's content does not already open with one.
 */
function RestaurantSettingsPageIntro({
  title,
  description,
}: Pick<RestaurantSettingsPageShellProps, 'title' | 'description'>) {
  const { headingContext } = useRestaurantSettingsContext();

  const useExplicitOverrides = title != null || description != null;
  const hidePageIntro = !useExplicitOverrides && (headingContext?.hidePageIntro ?? false);
  const resolvedDescription = description ?? headingContext?.pageDescription ?? DEFAULT_DESCRIPTION;

  if (hidePageIntro || !resolvedDescription) {
    return null;
  }

  return (
    <p className="max-w-[65ch] text-sm leading-6 text-muted-foreground">{resolvedDescription}</p>
  );
}

export function RestaurantSettingsPageShell({
  title,
  description,
  children,
  envBanner,
}: RestaurantSettingsPageShellProps) {
  const reduceMotion = usePrefersReducedMotion();
  const { headingContext, routeView } = useRestaurantSettingsContext();
  const hidePageIntro =
    title == null && description == null ? (headingContext?.hidePageIntro ?? false) : false;
  // The Google Business Profile workspace is the comparison itself; a strip there repeats it.
  const showGbpStrip = routeView !== 'google-business-profile';

  return (
    <GbpDriftProvider>
      <RestaurantSettingsFocusedShell envBanner={envBanner} title={title}>
        <RestaurantSettingsPageIntro title={title} description={description} />
        {showGbpStrip ? <GbpDriftStatusStrip compact={hidePageIntro} /> : null}
        <motion.div
          // Always animate to visible; reduced motion only makes it instant. The preference is read
          // after mount, so switching `animate` off would leave the content stuck at opacity 0.
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.18, ease: 'easeOut' }}
        >
          {children}
        </motion.div>
      </RestaurantSettingsFocusedShell>
    </GbpDriftProvider>
  );
}
