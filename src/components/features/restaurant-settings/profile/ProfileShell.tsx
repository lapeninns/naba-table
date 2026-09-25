'use client';

import { RESTAURANT_SETTINGS_ROUTE_MAP } from '../routes';
import { RestaurantSettingsCommandCenter } from '../shared';

import type { RestaurantSettingsCommandRailItem } from '../shared';
import type { ReactNode } from 'react';

type ProfileShellProps = {
  /** In-page jump bar; only the loaded page has one. */
  railItems?: RestaurantSettingsCommandRailItem[];
  /** Save status line under the purpose sentence. */
  status?: ReactNode;
  children: ReactNode;
};

const PROFILE_ROUTE = RESTAURANT_SETTINGS_ROUTE_MAP.profile;

/** Page frame shared by every Profile state (loaded, loading, error, no restaurant). */
export function ProfileShell({ railItems, status, children }: ProfileShellProps) {
  return (
    <RestaurantSettingsCommandCenter
      title={PROFILE_ROUTE.title}
      description={PROFILE_ROUTE.description}
      status={status}
      railTitle="Sections on this page"
      railItems={railItems}
    >
      {children}
    </RestaurantSettingsCommandCenter>
  );
}

/**
 * One column below `xl`; from `xl` the readiness panel is a sticky ~320px column beside
 * the sections.
 */
export const PROFILE_LAYOUT_GRID_CLASS =
  'grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]';
