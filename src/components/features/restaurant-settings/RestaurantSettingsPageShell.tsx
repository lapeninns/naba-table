'use client';

import { type ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { GbpDriftStatusStrip } from './gbp-drift/GbpDriftStatusStrip';
import { GbpDriftProvider } from './GbpDriftProvider';
import { RestaurantSettingsFocusedShell } from './RestaurantSettingsFocusedShell';
import { RESTAURANT_SETTINGS_ROUTE_MAP } from './routes';
import { SETTINGS_ENTER_FADE_CLASS } from './shared/compactSettingsClasses';
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
  const { headingContext, routeView } = useRestaurantSettingsContext();
  const hidePageIntro =
    title == null && description == null ? (headingContext?.hidePageIntro ?? false) : false;
  const workspace = routeView
    ? RESTAURANT_SETTINGS_ROUTE_MAP[routeView].layout === 'workspace'
    : false;
  // The Google Business Profile workspace is the comparison itself; a strip there repeats it.
  // Full-height workspaces have no room for it either, and don't edit Google-synced details.
  const showGbpStrip = routeView !== 'google-business-profile' && !workspace;

  return (
    <GbpDriftProvider>
      <RestaurantSettingsFocusedShell envBanner={envBanner} title={title} workspace={workspace}>
        {workspace ? null : <RestaurantSettingsPageIntro title={title} description={description} />}
        {showGbpStrip ? <GbpDriftStatusStrip compact={hidePageIntro} /> : null}
        <div className={cn(SETTINGS_ENTER_FADE_CLASS, workspace && 'flex min-h-0 flex-1 flex-col')}>
          {children}
        </div>
      </RestaurantSettingsFocusedShell>
    </GbpDriftProvider>
  );
}
