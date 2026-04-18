import {
  BarChart3,
  CalendarDays,
  CircleHelp,
  DoorOpen,
  LayoutGrid,
  Mail,
  MailCheck,
  Sparkles,
  Clock3,
  Timer,
  TrendingDown,
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

const OPS_BASE_PATH = '/app';

function path(segment: string): string {
  return `${OPS_BASE_PATH}${segment}`;
}

export const OPS_NAV_SECTIONS: OpsNavigationSection[] = [
  {
    label: 'Service',
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
    ],
  },
  {
    label: 'Guest & Insights',
    items: [
      {
        title: 'Guests',
        description: 'Review guest history and contact details',
        href: path('/customers'),
        icon: Users,
        match: (pathname) => pathname.startsWith(path('/customers')),
      },
      {
        title: 'Email Delivery',
        description: 'Track sent/delivered/bounced email status',
        href: path('/email-delivery'),
        icon: MailCheck,
        match: (pathname) => pathname.startsWith(path('/email-delivery')),
      },
      {
        title: 'Email Templates',
        description: 'Craft and A/B test guest email copy',
        href: path('/email-templates'),
        icon: Mail,
        match: (pathname) => pathname.startsWith(path('/email-templates')),
      },
      {
        title: 'Rejections',
        description: 'Analyze booking rejections',
        href: path('/rejections'),
        icon: TrendingDown,
        match: (pathname) => pathname === path('/rejections'),
        requiresFeatureFlag: 'rejectionAnalytics',
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
        title: 'Menu',
        description: 'Manage menu items and modifiers',
        href: path('/settings/restaurant/menu'),
        icon: UtensilsCrossed,
        match: (pathname) => pathname.startsWith(path('/settings/restaurant/menu')),
      },
      {
        title: 'Reservation Durations',
        description: 'Party-size turn times',
        href: path('/settings/restaurant/turn-durations'),
        icon: Timer,
        match: (pathname) => pathname.startsWith(path('/settings/restaurant/turn-durations')),
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
