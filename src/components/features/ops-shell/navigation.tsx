import { BarChart3, CalendarDays, CalendarPlus, CircleHelp, SlidersHorizontal, Users, UsersRound } from 'lucide-react';

import type { ComponentType, SVGProps } from 'react';

export type OpsNavigationItem = {
  title: string;
  description?: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  match?: (pathname: string) => boolean;
};

export type OpsNavigationSection = {
  label: string;
  items: OpsNavigationItem[];
};

export const OPS_NAV_SECTIONS: OpsNavigationSection[] = [
  {
    label: 'Daily operations',
    items: [
      {
        title: 'Dashboard',
        description: 'Today’s service overview',
        href: '/ops',
        icon: BarChart3,
        match: (pathname) => pathname === '/ops',
      },
      {
        title: 'Bookings',
        description: 'Manage reservations',
        href: '/ops/bookings',
        icon: CalendarDays,
        match: (pathname) => pathname === '/ops/bookings',
      },
      {
        title: 'Customers',
        description: 'Review guest history and contact details',
        href: '/ops/customer-details',
        icon: Users,
        match: (pathname) => pathname.startsWith('/ops/customer-details'),
      },
      {
        title: 'Walk-in booking',
        description: 'Record guests on arrival',
        href: '/ops/bookings/new',
        icon: CalendarPlus,
        match: (pathname) => pathname.startsWith('/ops/bookings/new'),
      },
    ],
  },
  {
    label: 'Restaurant management',
    items: [
      {
        title: 'Team',
        description: 'Manage staff invitations',
        href: '/ops/team',
        icon: UsersRound,
        match: (pathname) => pathname.startsWith('/ops/team'),
      },
      {
        title: 'Restaurant settings',
        description: 'Configure hours and service periods',
        href: '/ops/restaurant-settings',
        icon: SlidersHorizontal,
        match: (pathname) => pathname.startsWith('/ops/restaurant-settings'),
      },
    ],
  },
];

export const OPS_SUPPORT_ITEM: OpsNavigationItem = {
  title: 'Support',
  description: 'Get help from SajiloReserveX',
  href: 'mailto:support@sajiloreservex.com',
  icon: CircleHelp,
  match: () => false,
};

export function isNavItemActive(pathname: string, item: OpsNavigationItem): boolean {
  if (item.match) {
    return item.match(pathname);
  }
  return pathname === item.href;
}
