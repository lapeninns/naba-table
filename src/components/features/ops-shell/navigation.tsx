import {
  BarChart3,
  CalendarDays,
  CircleHelp,
  GanttChart,
  LayoutGrid,
  Map,
  OctagonAlert,
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
      {
        title: 'Tables',
        description: 'Manage table inventory',
        href: '/seating/tables',
        icon: LayoutGrid,
        match: (pathname) => pathname.startsWith('/seating/tables'),
      },
    ],
  },
  {
    label: 'Management',
    items: [
      {
        title: 'Team',
        description: 'Manage staff invitations',
        href: '/management/team',
        icon: UsersRound,
        match: (pathname) => pathname.startsWith('/management/team'),
      },
    ],
  },
  {
    label: 'Settings',
    items: [
      {
        title: 'Restaurant Settings',
        description: 'Profile, hours, and service periods',
        href: '/settings/restaurant',
        icon: SlidersHorizontal,
        match: (pathname) => pathname.startsWith('/settings/restaurant'),
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
