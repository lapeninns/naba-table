'use client';

import { RESTAURANT_SETTINGS_ROUTE_MAP } from '../routes';
import { RestaurantSettingsCommandCenter, SETTINGS_ASIDE_GRID_CLASS } from '../shared';

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
 * One column below `xl`; from `xl` the readiness panel is a sticky 20rem column beside
 * the sections (the shared settings aside grid).
 */
export const PROFILE_LAYOUT_GRID_CLASS = SETTINGS_ASIDE_GRID_CLASS;
