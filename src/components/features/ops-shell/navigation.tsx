import {
  BarChart3,
  CalendarDays,
  CalendarPlus,
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
        description: 'Today’s service overview',
        href: '/',
        icon: BarChart3,
        match: (pathname) => pathname === '/',
      },
      {
        title: 'Floor Plan',
        description: 'Visual table management',
        href: '/floor-plan',
        icon: Map,
        match: (pathname) => pathname.startsWith('/floor-plan'),
      },
      {
        title: 'Capacity',
        description: 'Timeline view of table availability',
        href: '/capacity',
        icon: GanttChart,
        match: (pathname) => pathname.startsWith('/capacity'),
      },
      {
        title: 'Rejections',
        description: 'Understand why bookings were skipped',
        href: '/rejections',
        icon: OctagonAlert,
        match: (pathname) => pathname.startsWith('/rejections'),
        requiresFeatureFlag: 'rejectionAnalytics',
      },
      {
        title: 'Bookings',
        description: 'Manage reservations',
        href: '/bookings',
        icon: CalendarDays,
        match: (pathname) => pathname === '/bookings',
      },
      {
        title: 'Customers',
        description: 'Review guest history and contact details',
        href: '/customers',
        icon: Users,
        match: (pathname) => pathname.startsWith('/customers'),
      },
      {
        title: 'Walk-in booking',
        description: 'Record guests on arrival',
        href: '/bookings/new',
        icon: CalendarPlus,
        match: (pathname) => pathname.startsWith('/bookings/new'),
      },
    ],
  },
  {
    label: 'Restaurant management',
    items: [
      {
        title: 'Team',
        description: 'Manage staff invitations',
        href: '/team',
        icon: UsersRound,
        match: (pathname) => pathname.startsWith('/team'),
      },
      {
        title: 'Tables',
        description: 'Manage table inventory',
        href: '/tables',
        icon: LayoutGrid,
        match: (pathname) => pathname.startsWith('/tables'),
      },
      {
        title: 'Profile',
        description: 'Restaurant details and branding',
        href: '/profile',
        icon: SlidersHorizontal,
        match: (pathname) => pathname.startsWith('/profile'),
      },
      {
        title: 'Hours',
        description: 'Configure service periods',
        href: '/hours',
        icon: CalendarDays,
        match: (pathname) => pathname.startsWith('/hours'),
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
