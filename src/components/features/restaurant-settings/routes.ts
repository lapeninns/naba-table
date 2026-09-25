import { normalizeOpsPathname, opsHref } from '@/lib/url/opsHref';

import {
  AVAILABILITY_ANCHORS,
  availabilityHash,
  type AvailabilityAnchor,
} from './availabilityAnchors';

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

/**
 * Former standalone availability routes. Each still has its own page, which renders the single
 * Availability page and opens it on the section that replaced the old route.
 */
export type RestaurantSettingsAliasRoute = {
  /** Route segment after `/settings/restaurant/`, shown in the alias notice. */
  slug: string;
  href: string;
  title: string;
  description: string;
  availabilityAnchor: AvailabilityAnchor;
};

function availabilityAlias(
  slug: string,
  anchor: AvailabilityAnchor,
  title: string,
  description: string,
): RestaurantSettingsAliasRoute {
  return {
    slug,
    href: opsHref(`/settings/restaurant/${slug}${availabilityHash(anchor)}`),
    title,
    description,
    availabilityAnchor: anchor,
  };
}

export const RESTAURANT_SETTINGS_AVAILABILITY_ALIASES: RestaurantSettingsAliasRoute[] = [
  availabilityAlias(
    'service-periods',
    AVAILABILITY_ANCHORS.serviceWindows,
    'Service periods',
    'Define lunch, dinner, and other booking windows inside operating hours.',
  ),
  availabilityAlias(
    'operating-hours',
    AVAILABILITY_ANCHORS.weeklyHours,
    'Operating hours',
    'Configure weekly open and close times plus date-specific overrides.',
  ),
  availabilityAlias(
    'turn-durations',
    AVAILABILITY_ANCHORS.bookingOccasions,
    'Dining durations',
    'Configure table-time bands by booking type and party size.',
  ),
  availabilityAlias(
    'occasions',
    AVAILABILITY_ANCHORS.bookingOccasions,
    'Booking types',
    'Control the lunch, dinner, and occasion types staff and guests can use.',
  ),
];

export const RESTAURANT_SETTINGS_OVERVIEW_ROUTE: RestaurantSettingsOverviewRoute = {
  href: opsHref('/settings/restaurant'),
  title: 'Restaurant setup',
  description: 'What has to be in place before guests can book, and what you can add later.',
};

export const RESTAURANT_SETTINGS_ROUTES: RestaurantSettingsRoute[] = [
  {
    view: 'profile',
    href: opsHref('/settings/restaurant/profile'),
    title: 'Restaurant profile',
    description:
      'What guests see when they book: your name, booking page link, contact details and location.',
  },
  {
    view: 'discovery',
    href: opsHref('/settings/restaurant/discovery'),
    title: 'Discovery details',
    description:
      'Details that help guests find and choose you, such as categories, links and amenities. Google is optional. If it’s linked, it can suggest values here.',
  },
  {
    view: 'google-business-profile',
    href: opsHref('/settings/restaurant/google-business-profile'),
    title: 'Google Business Profile',
    description:
      'Optional. Link your Google listing to compare your public details and publish changes. Bookings work without it.',
  },
  {
    view: 'availability',
    href: opsHref('/settings/restaurant/availability'),
    aliases: [...RESTAURANT_SETTINGS_AVAILABILITY_ALIASES.map((item) => item.href)],
    title: 'Availability & Booking types',
    description:
      'Opening hours, meal times and booking rules decide which times guests can request. Tables and existing bookings are checked separately when a guest books.',
  },
  {
    view: 'menu',
    href: opsHref('/settings/restaurant/menu'),
    title: 'Menu',
    description:
      'Food and drinks guests can see. Each change saves when you confirm it. Publishing to Google happens separately.',
  },
  {
    view: 'tables',
    href: opsHref('/settings/restaurant/tables'),
    title: 'Tables',
    description:
      'Tables and zones decide who can be seated. Only active tables in zones that are in service can be given to bookings.',
  },
  {
    view: 'team',
    href: opsHref('/settings/restaurant/team'),
    title: 'Team',
    description: 'Invite people to help run this restaurant and keep track of their invitations.',
  },
  {
    view: 'staff-communications',
    href: opsHref('/settings/restaurant/staff-communications'),
    title: 'Staff communications',
    description:
      'Who we tell about bookings: the manager alert number, the daily booking summary and WhatsApp. Guests never see the alert number.',
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
  getRoute('staff-communications'),
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

/** The former availability route the pathname points at, or null for every other route. */
export function getRestaurantSettingsAvailabilityAlias(
  pathname: string | null | undefined,
): RestaurantSettingsAliasRoute | null {
  if (!pathname) {
    return null;
  }
  const normalizedPathname = normalizeOpsPathname(pathname);
  return (
    RESTAURANT_SETTINGS_AVAILABILITY_ALIASES.find(
      (item) => normalizeOpsPathname(item.href) === normalizedPathname,
    ) ?? null
  );
}

/**
 * Route copy for a pathname. Former availability routes resolve to the Availability page, which
 * is what they render.
 */
export function getRestaurantSettingsRouteCopy(pathname: string) {
  const normalizedPathname = normalizeOpsPathname(pathname);
  if (normalizedPathname === normalizeOpsPathname(RESTAURANT_SETTINGS_OVERVIEW_ROUTE.href)) {
    return RESTAURANT_SETTINGS_OVERVIEW_ROUTE;
  }

  if (getRestaurantSettingsAvailabilityAlias(pathname)) {
    return RESTAURANT_SETTINGS_ROUTE_MAP.availability;
  }

  return (
    RESTAURANT_SETTINGS_ROUTES.find((route) => {
      const normalizedHref = normalizeOpsPathname(route.href);
      return (
        normalizedPathname === normalizedHref || normalizedPathname.startsWith(`${normalizedHref}/`)
      );
    }) ?? null
  );
}

/** Browser-tab suffix for ops pages (legacy product spelling kept until the owner decides). */
export const RESTAURANT_SETTINGS_METADATA_SUFFIX = ' · Nab a Table Ops';

/**
 * Page metadata derived from the same route copy the settings chrome shows, so the tab title,
 * breadcrumb, and page intro never drift apart.
 */
export function getRestaurantSettingsMetadata(settingsPath: string) {
  const route = getRestaurantSettingsRouteCopy(opsHref(settingsPath));
  if (!route) {
    throw new Error(`Missing restaurant settings route copy for ${settingsPath}`);
  }
  return {
    title: `${route.title}${RESTAURANT_SETTINGS_METADATA_SUFFIX}`,
    description: route.description,
  };
}

/**
 * Unsaved-changes registry id per settings page. The page registers its draft under this id and
 * the settings sidebar marks the matching item "Unsaved".
 */
export const RESTAURANT_SETTINGS_UNSAVED_ENTRY_IDS = {
  profile: 'restaurant-profile',
  discovery: 'restaurant-discovery',
  availability: 'restaurant-availability',
  team: 'team-invite-draft',
  'staff-communications': 'restaurant-staff-communications',
} as const satisfies Partial<Record<RestaurantSettingsView, string>>;
