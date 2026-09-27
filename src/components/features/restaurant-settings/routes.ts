import { normalizeOpsPathname, opsHref } from '@/lib/url/opsHref';

import { AVAILABILITY_ANCHORS, availabilityHash } from './availabilityAnchors';

import type { RestaurantSettingsView } from './types';

export type RestaurantSettingsRoute = {
  /** Also the URL segment: every page is `/app/settings/restaurant/<view>`, named after its title. */
  view: RestaurantSettingsView;
  href: string;
  title: string;
  description: string;
  /**
   * `workspace` routes fill the content area edge to edge and scroll their own panes (floor
   * layout canvas, email template editor). Everything else is a padded, scrolling page.
   */
  layout?: 'page' | 'workspace';
};

export type RestaurantSettingsOverviewRoute = {
  href: string;
  title: string;
  description: string;
};

/** A former settings URL. Its page redirects to `to`, a live settings page. */
export type RestaurantSettingsRetiredRoute = {
  from: string;
  to: string;
};

export const RESTAURANT_SETTINGS_OVERVIEW_ROUTE: RestaurantSettingsOverviewRoute = {
  href: opsHref('/settings/restaurant'),
  title: 'Restaurant setup',
  description: 'What has to be in place before guests can book, and what you can add later.',
};

export const RESTAURANT_SETTINGS_ROUTES: RestaurantSettingsRoute[] = [
  {
    view: 'profile',
    href: opsHref('/settings/restaurant/profile'),
    title: 'Profile',
    description:
      'What guests see when they book: your name, booking page link, contact details and location.',
  },
  {
    view: 'discovery',
    href: opsHref('/settings/restaurant/discovery'),
    title: 'Discovery',
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
    title: 'Availability',
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
      'Your room, zone by zone. Only active tables in zones that are in service can be given to bookings.',
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
  {
    view: 'floor-layout',
    href: opsHref('/settings/restaurant/floor-layout'),
    title: 'Floor layout',
    description:
      'Where each table sits in its zone on the floor plan. Moving tables here never changes bookings.',
    layout: 'workspace',
  },
  {
    view: 'email-templates',
    href: opsHref('/settings/restaurant/email-templates'),
    title: 'Email templates',
    description: 'Write, test and A/B test the emails guests receive about their booking.',
    layout: 'workspace',
  },
];

export type RestaurantSettingsNavItem = Pick<
  RestaurantSettingsRoute,
  'href' | 'title' | 'description'
>;

const getRoute = (view: RestaurantSettingsView): RestaurantSettingsNavItem => {
  const route = RESTAURANT_SETTINGS_ROUTES.find((item) => item.view === view);
  if (!route) throw new Error(`Missing restaurant settings route for view: ${view}`);
  return {
    href: route.href,
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
  getRoute('floor-layout'),
  getRoute('email-templates'),
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

/** Route copy for a pathname. */
export function getRestaurantSettingsRouteCopy(pathname: string) {
  const normalizedPathname = normalizeOpsPathname(pathname);
  if (normalizedPathname === normalizeOpsPathname(RESTAURANT_SETTINGS_OVERVIEW_ROUTE.href)) {
    return RESTAURANT_SETTINGS_OVERVIEW_ROUTE;
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
  // Registered by the floor plan controller while layout drafts are unsaved.
  'floor-layout': 'floor-plan-layout',
  // Registered by useOpsEmailTemplatesEditor while any email has unsaved copy.
  'email-templates': 'restaurant-email-templates',
} as const satisfies Partial<Record<RestaurantSettingsView, string>>;

const AVAILABILITY_HREF = opsHref('/settings/restaurant/availability');

/**
 * Former settings URLs, each with its own page that redirects here. Links in the app
 * must use the live `href`s above; a test fails if source code points at a `from` URL.
 */
export const RESTAURANT_SETTINGS_RETIRED_ROUTES: RestaurantSettingsRetiredRoute[] = [
  { from: opsHref('/settings'), to: RESTAURANT_SETTINGS_OVERVIEW_ROUTE.href },
  { from: opsHref('/settings/tables'), to: RESTAURANT_SETTINGS_ROUTE_MAP.tables.href },
  { from: opsHref('/management/team'), to: RESTAURANT_SETTINGS_ROUTE_MAP.team.href },
  { from: opsHref('/email-templates'), to: RESTAURANT_SETTINGS_ROUTE_MAP['email-templates'].href },
  {
    from: opsHref('/settings/restaurant/table-layout'),
    to: RESTAURANT_SETTINGS_ROUTE_MAP['floor-layout'].href,
  },
  {
    from: opsHref('/settings/restaurant/operating-hours'),
    to: `${AVAILABILITY_HREF}${availabilityHash(AVAILABILITY_ANCHORS.weeklyHours)}`,
  },
  {
    from: opsHref('/settings/restaurant/service-periods'),
    to: `${AVAILABILITY_HREF}${availabilityHash(AVAILABILITY_ANCHORS.serviceWindows)}`,
  },
  {
    from: opsHref('/settings/restaurant/turn-durations'),
    to: `${AVAILABILITY_HREF}${availabilityHash(AVAILABILITY_ANCHORS.bookingOccasions)}`,
  },
  {
    from: opsHref('/settings/restaurant/occasions'),
    to: `${AVAILABILITY_HREF}${availabilityHash(AVAILABILITY_ANCHORS.bookingOccasions)}`,
  },
];

/** Where a retired settings URL now lives. Throws for a URL that was never retired. */
export function getRetiredRestaurantSettingsTarget(from: string): string {
  const route = RESTAURANT_SETTINGS_RETIRED_ROUTES.find((item) => item.from === opsHref(from));
  if (!route) throw new Error(`Not a retired restaurant settings route: ${from}`);
  return route.to;
}
