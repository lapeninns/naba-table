import { normalizeOpsPathname, opsHref } from '@/lib/url/opsHref';

import { AVAILABILITY_ANCHORS, availabilityHash } from './availabilityAnchors';

import type { RestaurantSettingsView } from './types';

export type RestaurantSettingsRoute = {
  view: RestaurantSettingsView;
  href: string;
  aliases?: string[];
  title: string;
  description: string;
};

export type RestaurantSettingsOverviewRoute = {
  href: string;
  title: string;
  description: string;
};

export type AvailabilitySettingsWorkspace = 'rules' | 'schedule' | 'booking-types';

export type RestaurantSettingsAliasRoute = {
  href: string;
  title: string;
  description: string;
  availabilityWorkspace: AvailabilitySettingsWorkspace;
};

export const RESTAURANT_SETTINGS_AVAILABILITY_ALIASES: RestaurantSettingsAliasRoute[] = [
  {
    href: opsHref(
      `/settings/restaurant/service-periods${availabilityHash(AVAILABILITY_ANCHORS.serviceWindows)}`,
    ),
    title: 'Service periods',
    description: 'Define lunch, dinner, and other booking windows inside operating hours.',
    availabilityWorkspace: 'schedule',
  },
  {
    href: opsHref(
      `/settings/restaurant/operating-hours${availabilityHash(AVAILABILITY_ANCHORS.weeklyHours)}`,
    ),
    title: 'Operating hours',
    description: 'Configure weekly open and close times plus date-specific overrides.',
    availabilityWorkspace: 'schedule',
  },
  {
    href: opsHref(
      `/settings/restaurant/turn-durations${availabilityHash(AVAILABILITY_ANCHORS.bookingOccasions)}`,
    ),
    title: 'Reservation durations',
    description: 'Configure table-time bands by booking type and party size.',
    availabilityWorkspace: 'booking-types',
  },
  {
    href: opsHref(
      `/settings/restaurant/occasions${availabilityHash(AVAILABILITY_ANCHORS.bookingOccasions)}`,
    ),
    title: 'Booking types',
    description: 'Control the lunch, dinner, and occasion types staff and guests can use.',
    availabilityWorkspace: 'booking-types',
  },
];

export const RESTAURANT_SETTINGS_OVERVIEW_ROUTE: RestaurantSettingsOverviewRoute = {
  href: opsHref('/settings/restaurant'),
  title: 'Restaurant setup',
  description: 'Track the required setup steps for profile, booking availability, and seating.',
};

export const RESTAURANT_SETTINGS_ROUTES: RestaurantSettingsRoute[] = [
  {
    view: 'profile',
    href: opsHref('/settings/restaurant/profile'),
    title: 'Restaurant profile',
    description: 'Public details, booking page URL, and manager alerts.',
  },
  {
    view: 'discovery',
    href: opsHref('/settings/restaurant/discovery'),
    title: 'Discovery details',
    description: 'Categories, links, and attributes that help guests find your restaurant.',
  },
  {
    view: 'google-business-profile',
    href: opsHref('/settings/restaurant/google-business-profile'),
    title: 'Google Business Profile',
    description: 'Optional: connect Google to import and compare public details.',
  },
  {
    view: 'availability',
    href: opsHref('/settings/restaurant/availability'),
    aliases: [...RESTAURANT_SETTINGS_AVAILABILITY_ALIASES.map((item) => item.href)],
    title: 'Availability & Booking types',
    description:
      'Booking rules, weekly hours, overrides, meal windows, booking types, and dining-duration bands.',
  },
  {
    view: 'menu',
    href: opsHref('/settings/restaurant/menu'),
    title: 'Menu',
    description:
      'Manage menus, sections, items, options, and details that can be published to Google.',
  },
  {
    view: 'tables',
    href: opsHref('/settings/restaurant/tables'),
    title: 'Tables',
    description: 'Manage table inventory, zones, and capacity.',
  },
  {
    view: 'team',
    href: opsHref('/settings/restaurant/team'),
    title: 'Team',
    description: 'Invite and manage restaurant staff access.',
  },
];

export type RestaurantSettingsNavItem = Pick<
  RestaurantSettingsRoute,
  'href' | 'aliases' | 'title' | 'description'
>;

const getRoute = (view: RestaurantSettingsView): RestaurantSettingsNavItem => {
  const route = RESTAURANT_SETTINGS_ROUTES.find((item) => item.view === view);
  if (!route) throw new Error(`Missing restaurant settings route for view: ${view}`);
  return {
    href: route.href,
    aliases: route.aliases,
    title: route.title,
    description: route.description,
  };
};

export const RESTAURANT_SETTINGS_NAV_ITEMS: RestaurantSettingsNavItem[] = [
  getRoute('profile'),
  getRoute('discovery'),
  getRoute('google-business-profile'),
  getRoute('availability'),
  getRoute('menu'),
  getRoute('tables'),
  getRoute('team'),
];

export const RESTAURANT_SETTINGS_ROUTE_MAP: Record<
  RestaurantSettingsView,
  RestaurantSettingsRoute
> = RESTAURANT_SETTINGS_ROUTES.reduce<Record<RestaurantSettingsView, RestaurantSettingsRoute>>(
  (acc, route) => {
    acc[route.view] = route;
    return acc;
  },
  {} as Record<RestaurantSettingsView, RestaurantSettingsRoute>,
);

export function getRestaurantSettingsRouteCopy(pathname: string) {
  const normalizedPathname = normalizeOpsPathname(pathname);
  if (normalizedPathname === normalizeOpsPathname(RESTAURANT_SETTINGS_OVERVIEW_ROUTE.href)) {
    return RESTAURANT_SETTINGS_OVERVIEW_ROUTE;
  }

  const alias = RESTAURANT_SETTINGS_AVAILABILITY_ALIASES.find(
    (item) => normalizeOpsPathname(item.href) === normalizedPathname,
  );
  if (alias) {
    return alias;
  }

  return (
    RESTAURANT_SETTINGS_ROUTES.find((route) => {
      const normalizedHref = normalizeOpsPathname(route.href);
      if (normalizedHref === '/settings/restaurant') {
        return normalizedPathname === normalizedHref;
      }
      return (
        normalizedPathname === normalizedHref || normalizedPathname.startsWith(`${normalizedHref}/`)
      );
    }) ?? null
  );
}
