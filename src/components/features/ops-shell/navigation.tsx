import {
  BarChart3,
  CalendarDays,
  CircleHelp,
  DoorOpen,
  LayoutGrid,
  MessageSquare,
  Settings2,
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
        title: 'New Booking',
        description: 'Take a phone booking or seat a walk-in',
        href: path('/new-bookings'),
        icon: DoorOpen,
        match: (pathname) => pathname === path('/new-bookings'),
      },
      {
        title: 'Floor plan',
        description: 'Seat arrivals and assign tables live',
        href: path('/seating/floor-plan'),
        icon: LayoutGrid,
        match: (pathname) => pathname.startsWith(path('/seating/floor-plan')),
      },
      {
        title: 'Bookings',
        description: 'Manage reservations',
        href: path('/bookings'),
        icon: CalendarDays,
        match: (pathname) =>
          pathname === path('/bookings') || pathname.startsWith(path('/bookings/')),
      },
    ],
  },
  {
    label: 'Guests & Communications',
    items: [
      {
        title: 'Guests',
        description: 'Review guest history and contact details',
        href: path('/customers'),
        icon: Users,
        match: (pathname) => pathname.startsWith(path('/customers')),
      },
      {
        title: 'Communications Delivery',
        description: 'Monitor email, SMS, and WhatsApp delivery health',
        href: path('/communications-delivery'),
        icon: MessageSquare,
        match: (pathname) =>
          pathname.startsWith(path('/communications-delivery')) ||
          pathname.startsWith(path('/email-delivery')) ||
          pathname.startsWith(path('/sms-delivery')) ||
          pathname.startsWith(path('/message-delivery')),
        requiresActiveAdmin: true,
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
