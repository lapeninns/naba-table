import {
  BarChart3,
  CalendarDays,
  CircleHelp,
  DoorOpen,
  GanttChart,
  LayoutGrid,
  Map,
  OctagonAlert,
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

export const OPS_NAV_SECTIONS: OpsNavigationSection[] = [
  {
    label: 'Daily operations',
    items: [
      {
        title: 'Dashboard',
        description: 'Today\'s service overview',
        href: '/',
        icon: BarChart3,
        match: (pathname) => pathname === '/',
      },
      {
        title: 'Bookings',
        description: 'Manage reservations',
        href: '/bookings',
        icon: CalendarDays,
        match: (pathname) => pathname === '/bookings' || pathname.startsWith('/bookings/'),
      },
      {
        title: 'Walk-ins',
        description: 'Log arrivals on the floor',
        href: '/walk-in',
        icon: DoorOpen,
        match: (pathname) => pathname === '/walk-in',
      },
      {
        title: 'Customers',
        description: 'Review guest history and contact details',
        href: '/customers',
        icon: Users,
        match: (pathname) => pathname.startsWith('/customers'),
      },
    ],
  },
  {
    label: 'Seating',
    items: [
      {
        title: 'Floor Plan',
        description: 'Visual table management',
        href: '/seating/floor-plan',
        icon: Map,
        match: (pathname) => pathname.startsWith('/seating/floor-plan'),
      },
      {
        title: 'Capacity',
        description: 'Timeline view of table availability',
        href: '/seating/capacity',
        icon: GanttChart,
        match: (pathname) => pathname.startsWith('/seating/capacity'),
      },
    ],
  },
  {
    label: 'Restaurant Settings',
    items: [
      {
        title: 'Restaurant Profile',
        description: 'Branding, contact, booking policy',
        href: '/settings/restaurant/profile',
        icon: SlidersHorizontal,
        match: (pathname) => pathname.startsWith('/settings/restaurant/profile'),
      },
      {
        title: 'Operating Hours',
        description: 'Weekly hours & overrides',
        href: '/settings/restaurant/operating-hours',
        icon: Clock3,
        match: (pathname) => pathname.startsWith('/settings/restaurant/operating-hours'),
      },
      {
        title: 'Booking Occasions',
        description: 'Guest/staff occasion options',
        href: '/settings/restaurant/occasions',
        icon: Sparkles,
        match: (pathname) => pathname.startsWith('/settings/restaurant/occasions'),
      },
      {
        title: 'Service Periods',
        description: 'Lunch & dinner booking windows',
        href: '/settings/restaurant/service-periods',
        icon: UtensilsCrossed,
        match: (pathname) => pathname.startsWith('/settings/restaurant/service-periods'),
      },
      {
        title: 'Tables',
        description: 'Manage table inventory',
        href: '/settings/tables',
        icon: LayoutGrid,
        match: (pathname) => pathname.startsWith('/settings/tables'),
      },
      {
        title: 'Team',
        description: 'Manage staff invitations',
        href: '/settings/restaurant/team',
        icon: UsersRound,
        match: (pathname) => pathname.startsWith('/settings/restaurant/team'),
      },
    ],
  },
  {
    label: 'Analytics',
    items: [
      {
        title: 'Rejections',
        description: 'Understand why bookings were skipped',
        href: '/analytics/rejections',
        icon: OctagonAlert,
        match: (pathname) => pathname.startsWith('/analytics/rejections'),
        requiresFeatureFlag: 'rejectionAnalytics',
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
