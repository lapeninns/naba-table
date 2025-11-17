import {
  BarChart3,
  CalendarDays,
  CalendarPlus,
  CircleHelp,
  GanttChart,
  LayoutGrid,
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
        href: '/ops',
        icon: BarChart3,
        match: (pathname) => pathname === '/ops',
      },
      {
        title: 'Capacity',
        description: 'Timeline view of table availability',
        href: '/ops/capacity',
        icon: GanttChart,
        match: (pathname) => pathname.startsWith('/ops/capacity'),
      },
      {
        title: 'Rejections',
        description: 'Understand why bookings were skipped',
        href: '/ops/rejections',
        icon: OctagonAlert,
        match: (pathname) => pathname.startsWith('/ops/rejections'),
        requiresFeatureFlag: 'rejectionAnalytics',
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
        href: '/ops/customers',
        icon: Users,
        match: (pathname) => pathname.startsWith('/ops/customers'),
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
        title: 'Tables',
        description: 'Manage table inventory',
        href: '/ops/tables',
        icon: LayoutGrid,
        match: (pathname) => pathname.startsWith('/ops/tables'),
      },
      {
        title: 'Restaurant settings',
        description: 'Configure hours and service periods',
        href: '/ops/settings/restaurant',
        icon: SlidersHorizontal,
        match: (pathname) => pathname.startsWith('/ops/settings'),
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
