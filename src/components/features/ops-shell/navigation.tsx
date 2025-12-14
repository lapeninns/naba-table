import {
  BarChart3,
  CalendarDays,
  CircleHelp,
  DoorOpen,
  GanttChart,
  LayoutGrid,
  Map,
  Sparkles,
  Clock3,
  UtensilsCrossed,
  SlidersHorizontal,
  Users,
  UsersRound,
} from 'lucide-react';

import type { OpsFeatureFlags } from '@/types/ops';
import type { ComponentType, SVGProps } from 'react';

export type OpsNavigationItem = {
  title: string;
  description?: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  match?: (pathname: string) => boolean;
  requiresFeatureFlag?: keyof OpsFeatureFlags;
};

export type OpsNavigationSection = {
  label: string;
  items: OpsNavigationItem[];
};

const OPS_BASE_PATH = '';

function path(segment: string): string {
  return `${OPS_BASE_PATH}${segment}`;
}

export const OPS_NAV_SECTIONS: OpsNavigationSection[] = [
  {
    label: 'Daily operations',
    items: [
      {
        title: 'Dashboard',
        description: 'Today\'s service overview',
        href: path('/dashboard'),
        icon: BarChart3,
        match: (pathname) => pathname === path('/dashboard') || pathname === OPS_BASE_PATH,
      },
      {
        title: 'Bookings',
        description: 'Manage reservations',
        href: path('/bookings'),
        icon: CalendarDays,
        match: (pathname) => pathname === path('/bookings') || pathname.startsWith(path('/bookings/')),
      },
      {
        title: 'New Bookings',
        description: 'Log arrivals on the floor',
        href: path('/new-bookings'),
        icon: DoorOpen,
        match: (pathname) => pathname === path('/new-bookings'),
      },
      {
        title: 'Customers',
        description: 'Review guest history and contact details',
        href: path('/customers'),
        icon: Users,
        match: (pathname) => pathname.startsWith(path('/customers')),
      },
    ],
  },
  {
    label: 'Seating',
    items: [
      {
        title: 'Floor Plan',
        description: 'Visual table management',
        href: path('/seating/floor-plan'),
        icon: Map,
        match: (pathname) => pathname.startsWith(path('/seating/floor-plan')),
      },
      {
        title: 'Capacity',
        description: 'Timeline view of table availability',
        href: path('/seating/capacity'),
        icon: GanttChart,
        match: (pathname) => pathname.startsWith(path('/seating/capacity')),
      },
    ],
  },
  {
    label: 'Restaurant Settings',
    items: [
      {
        title: 'Restaurant Profile',
        description: 'Branding, contact, booking policy',
        href: path('/settings/restaurant/profile'),
        icon: SlidersHorizontal,
        match: (pathname) => pathname.startsWith(path('/settings/restaurant/profile')),
      },
      {
        title: 'Operating Hours',
        description: 'Weekly hours & overrides',
        href: path('/settings/restaurant/operating-hours'),
        icon: Clock3,
        match: (pathname) => pathname.startsWith(path('/settings/restaurant/operating-hours')),
      },
      {
        title: 'Booking Occasions',
        description: 'Guest/staff occasion options',
        href: path('/settings/restaurant/occasions'),
        icon: Sparkles,
        match: (pathname) => pathname.startsWith(path('/settings/restaurant/occasions')),
      },
      {
        title: 'Service Periods',
        description: 'Lunch & dinner booking windows',
        href: path('/settings/restaurant/service-periods'),
        icon: UtensilsCrossed,
        match: (pathname) => pathname.startsWith(path('/settings/restaurant/service-periods')),
      },
      {
        title: 'Tables',
        description: 'Manage table inventory',
        href: path('/settings/tables'),
        icon: LayoutGrid,
        match: (pathname) => pathname.startsWith(path('/settings/tables')),
      },
      {
        title: 'Team',
        description: 'Manage staff invitations',
        href: path('/settings/restaurant/team'),
        icon: UsersRound,
        match: (pathname) => pathname.startsWith(path('/settings/restaurant/team')),
      },
    ],
  },

];

export const OPS_SUPPORT_ITEM: OpsNavigationItem = {
  title: 'Support',
  description: 'Get help from Nab a Table',
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
