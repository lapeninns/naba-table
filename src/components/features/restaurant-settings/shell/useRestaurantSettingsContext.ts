'use client';

import { usePathname } from 'next/navigation';
import { useMemo } from 'react';

import { useOpsSession } from '@/contexts/ops-session';

import { getRestaurantSettingsHeadingContext } from '../restaurantSettingsHeading';

import type { RestaurantSettingsHeadingContext } from '../restaurantSettingsHeading';
import type { RestaurantSettingsView } from '../types';
import type { OpsMembership } from '@/types/ops';

type RestaurantSettingsRouteContext = {
  readonly pathname: string | null;
  readonly headingContext: RestaurantSettingsHeadingContext | null;
  readonly routeView: RestaurantSettingsView | null;
};

type RestaurantSettingsMembershipContext = {
  readonly memberships: OpsMembership[];
  readonly activeRestaurantId: string | null;
  readonly activeMembership: OpsMembership | null;
  readonly restaurantId: string | null;
  readonly restaurantName: string | null;
  readonly setActiveRestaurantId: (restaurantId: string | null) => void;
};

export type RestaurantSettingsContext = RestaurantSettingsRouteContext &
  RestaurantSettingsMembershipContext;

function hasRouteView(route: RestaurantSettingsHeadingContext['route']): route is NonNullable<
  RestaurantSettingsHeadingContext['route']
> & {
  readonly view: RestaurantSettingsView;
} {
  return Boolean(route && typeof (route as { readonly view?: unknown }).view === 'string');
}

function getRouteView(
  headingContext: RestaurantSettingsHeadingContext | null,
): RestaurantSettingsView | null {
  const route = headingContext?.route;
  if (!route) {
    return null;
  }
  return hasRouteView(route) ? route.view : null;
}

export function useRestaurantSettingsContext(): RestaurantSettingsContext {
  const pathname = usePathname();
  const {
    memberships,
    activeRestaurantId,
    activeMembership: sessionActiveMembership,
    setActiveRestaurantId,
  } = useOpsSession();

  const headingContext = useMemo(() => {
    if (!pathname) {
      return null;
    }
    return getRestaurantSettingsHeadingContext(pathname);
  }, [pathname]);

  const activeMembership = useMemo(() => {
    return (
      sessionActiveMembership ??
      memberships.find((membership) => membership.restaurantId === activeRestaurantId) ??
      memberships[0] ??
      null
    );
  }, [activeRestaurantId, memberships, sessionActiveMembership]);

  return {
    pathname,
    headingContext,
    routeView: getRouteView(headingContext),
    memberships,
    activeRestaurantId,
    activeMembership,
    restaurantId: activeMembership?.restaurantId ?? null,
    restaurantName: activeMembership?.restaurantName ?? null,
    setActiveRestaurantId,
  };
}
