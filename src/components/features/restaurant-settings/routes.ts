import { opsHref } from '@/lib/url/opsHref';

import type { RestaurantSettingsView } from './types';

export type RestaurantSettingsRoute = {
  view: RestaurantSettingsView;
  href: string;
  title: string;
  description: string;
};

export const RESTAURANT_SETTINGS_ROUTES: RestaurantSettingsRoute[] = [
  {
    view: 'overview',
    href: opsHref('/settings/restaurant'),
    title: 'Restaurant setup',
    description: 'Complete the essentials that make this restaurant ready for bookings.',
  },
  {
    view: 'profile',
    href: opsHref('/settings/restaurant/profile'),
    title: 'Restaurant profile',
    description: 'Public details, booking page URL, manager alerts, and optional discovery.',
  },
  {
    view: 'google-business-profile',
    href: opsHref('/settings/restaurant/google-business-profile'),
    title: 'Google Business Profile',
    description: 'Optional import and comparison support for public restaurant details.',
  },
  {
    view: 'availability',
    href: opsHref('/settings/restaurant/availability'),
    title: 'Availability & Booking types',
    description:
      'Booking rules, weekly hours, overrides, meal windows, booking types, and dining-duration bands.',
  },
  {
    view: 'menu',
    href: opsHref('/settings/restaurant/menu'),
    title: 'Menu',
    description: 'Manage menus, sections, items, options, and Google-compatible publishing fields.',
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
  'href' | 'title' | 'description'
>;

const getRoute = (view: RestaurantSettingsView): RestaurantSettingsNavItem => {
  const route = RESTAURANT_SETTINGS_ROUTES.find((item) => item.view === view);
  if (!route) throw new Error(`Missing restaurant settings route for view: ${view}`);
  return { href: route.href, title: route.title, description: route.description };
};

export const RESTAURANT_SETTINGS_NAV_ITEMS: RestaurantSettingsNavItem[] = [
  getRoute('overview'),
  getRoute('profile'),
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
