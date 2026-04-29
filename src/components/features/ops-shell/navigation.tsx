import {
  BarChart3,
  CalendarDays,
  CircleHelp,
  DoorOpen,
  Globe2,
  LayoutGrid,
  Mail,
  MailCheck,
  MessageSquare,
  Clock3,
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
        description: "Today's service overview",
        href: path('/dashboard'),
        icon: BarChart3,
        match: (pathname) => pathname === path('/dashboard') || pathname === OPS_BASE_PATH,
      },
      {
        title: 'Bookings',
        description: 'Manage reservations',
        href: path('/bookings'),
        icon: CalendarDays,
        match: (pathname) =>
          pathname === path('/bookings') || pathname.startsWith(path('/bookings/')),
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
        title: 'SMS Delivery',
        description: 'Track queued/sent/delivered/failed SMS status',
        href: path('/sms-delivery'),
        icon: MessageSquare,
        match: (pathname) => pathname.startsWith(path('/sms-delivery')),
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
        title: 'Google Business Profile',
        description: 'Connect Google and review sync alignment',
        href: path('/settings/restaurant/google-business-profile'),
        icon: Globe2,
        match: (pathname) =>
          pathname.startsWith(path('/settings/restaurant/google-business-profile')),
      },
      {
        title: 'Availability & Occasions',
        description: 'Hours, overrides, meal windows, and occasions',
        href: path('/settings/restaurant/availability'),
        icon: Clock3,
        match: (pathname) => pathname.startsWith(path('/settings/restaurant/availability')),
      },
      {
        title: 'Menu',
        description: 'Manage menu items and modifiers',
        href: path('/settings/restaurant/menu'),
        icon: UtensilsCrossed,
        match: (pathname) => pathname.startsWith(path('/settings/restaurant/menu')),
      },
      {
        title: 'Tables',
        description: 'Manage table inventory',
        href: path('/settings/restaurant/tables'),
        icon: LayoutGrid,
        match: (pathname) => pathname.startsWith(path('/settings/restaurant/tables')),
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
