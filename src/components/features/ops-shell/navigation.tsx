import {
  BarChart3,
  CalendarDays,
  CircleHelp,
  DoorOpen,
  Mail,
  MailCheck,
  MessageSquare,
  Settings2,
  TrendingDown,
  Users,
} from 'lucide-react';

import type { ComponentType, SVGProps } from 'react';

export type OpsNavigationItem = {
  title: string;
  description?: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  match?: (pathname: string) => boolean;
  requiresActiveAdmin?: boolean;
};

export type OpsNavigationSection = {
  label?: string;
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
        requiresActiveAdmin: true,
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
      },
    ],
  },
  {
    items: [
      {
        title: 'Settings',
        description: 'Restaurant profile, hours, menu, tables, and team',
        href: path('/settings/restaurant/profile'),
        icon: Settings2,
        match: (pathname) => pathname.startsWith(path('/settings/restaurant')),
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

export function filterOpsNavigationSections(params: {
  sections?: readonly OpsNavigationSection[];
  canViewAdminItems: boolean;
}): OpsNavigationSection[] {
  const sections = params.sections ?? OPS_NAV_SECTIONS;
  return sections
    .map((section) => ({
      label: section.label,
      items: section.items.filter((item) => {
        if (item.requiresActiveAdmin && !params.canViewAdminItems) {
          return false;
        }
        return true;
      }),
    }))
    .filter((section) => section.items.length > 0);
}
