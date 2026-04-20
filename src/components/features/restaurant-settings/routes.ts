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
    view: 'profile',
    href: opsHref('/settings/restaurant/profile'),
    title: 'Restaurant Profile',
    description: 'Name, branding, contact details, booking policy, reminders.',
  },
  {
    view: 'google-business-profile',
    href: opsHref('/settings/restaurant/google-business-profile'),
    title: 'Google Business Profile',
    description: 'Connect Google, link a location, and prepare business info sync.',
  },
  {
    view: 'availability',
    href: opsHref('/settings/restaurant/availability'),
    title: 'Availability & Occasions',
    description:
      'Weekly hours, overrides, meal windows, occasions, and dining-duration bands in one place.',
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
  getRoute('profile'),
  getRoute('google-business-profile'),
  getRoute('availability'),
  {
    href: opsHref('/settings/restaurant/menu'),
    title: 'Menu',
    description: 'Manage menu items, modifiers, and imports.',
  },
  {
    href: opsHref('/settings/restaurant/tables'),
    title: 'Tables',
    description: 'Manage table inventory, zones, and capacity.',
  },
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
