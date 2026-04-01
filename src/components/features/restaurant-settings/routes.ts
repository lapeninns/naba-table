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
    href: '/settings/restaurant/profile',
    title: 'Restaurant Profile',
    description: 'Name, branding, contact details, booking policy, reminders.',
  },
  {
    view: 'operating-hours',
    href: '/settings/restaurant/operating-hours',
    title: 'Operating Hours',
    description: 'Weekly schedule and one-off overrides for open/close times.',
  },
  {
    view: 'email-templates',
    href: '/settings/restaurant/email-templates',
    title: 'Email Templates',
    description: 'Manage booking confirmation, reminder, cancellation, and review copy.',
  },
  {
    view: 'service-periods',
    href: '/settings/restaurant/service-periods',
    title: 'Service Periods',
    description: 'Lunch/dinner booking windows within operating hours.',
  },
  {
    view: 'turn-durations',
    href: '/settings/restaurant/turn-durations',
    title: 'Reservation Durations',
    description: 'Define dining duration bands by party size.',
  },
  {
    view: 'occasions',
    href: '/settings/restaurant/occasions',
    title: 'Booking occasions',
    description: 'Control available occasions and defaults.',
  },
  {
    view: 'team',
    href: '/settings/restaurant/team',
    title: 'Team',
    description: 'Invite and manage restaurant staff access.',
  },
];

export type RestaurantSettingsNavItem = Pick<RestaurantSettingsRoute, 'href' | 'title' | 'description'>;

const getRoute = (view: RestaurantSettingsView): RestaurantSettingsNavItem => {
  const route = RESTAURANT_SETTINGS_ROUTES.find((item) => item.view === view);
  if (!route) throw new Error(`Missing restaurant settings route for view: ${view}`);
  return { href: route.href, title: route.title, description: route.description };
};

export const RESTAURANT_SETTINGS_NAV_ITEMS: RestaurantSettingsNavItem[] = [
  getRoute('profile'),
  getRoute('operating-hours'),
  getRoute('email-templates'),
  getRoute('service-periods'),
  getRoute('turn-durations'),
  {
    href: '/settings/tables',
    title: 'Tables',
    description: 'Manage table inventory, zones, and capacity.',
  },
  getRoute('occasions'),
  getRoute('team'),
];

export const RESTAURANT_SETTINGS_ROUTE_MAP: Record<RestaurantSettingsView, RestaurantSettingsRoute> =
  RESTAURANT_SETTINGS_ROUTES.reduce<Record<RestaurantSettingsView, RestaurantSettingsRoute>>((acc, route) => {
    acc[route.view] = route;
    return acc;
  }, {} as Record<RestaurantSettingsView, RestaurantSettingsRoute>);
