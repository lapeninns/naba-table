import {
  CalendarClock,
  MapPinned,
  Menu,
  Table2,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react';

import { opsHref } from '@/lib/url/opsHref';

export type SetupStatus = 'complete' | 'attention' | 'optional';

export type SetupCard = {
  key: string;
  title: string;
  description: string;
  href: string;
  cta: string;
  status: SetupStatus;
  detail: string;
  Icon: LucideIcon;
};

type BuildSetupCardsInput = {
  profileComplete: boolean;
  availabilityComplete: boolean;
  tablesComplete: boolean;
  availableTables: number;
  menuCount: number;
  pendingInvites: number;
};

export function statusLabel(status: SetupStatus) {
  if (status === 'complete') return 'Complete';
  if (status === 'attention') return 'Needs attention';
  return 'Optional';
}

export function statusVariant(status: SetupStatus): 'default' | 'secondary' | 'outline' {
  if (status === 'complete') return 'default';
  if (status === 'attention') return 'secondary';
  return 'outline';
}

export function buildSetupCards({
  profileComplete,
  availabilityComplete,
  tablesComplete,
  availableTables,
  menuCount,
  pendingInvites,
}: BuildSetupCardsInput): SetupCard[] {
  return [
    {
      key: 'profile',
      title: 'Public profile',
      description: 'Controls the guest-facing name, contact details, address, and booking page.',
      href: opsHref('/settings/restaurant/profile'),
      cta: 'Open profile',
      status: profileComplete ? 'complete' : 'attention',
      detail: profileComplete
        ? 'Core public details are present.'
        : 'Add name, booking URL, timezone, and public phone before go-live.',
      Icon: UserRound,
    },
    {
      key: 'availability',
      title: 'Booking availability',
      description: 'Controls booking rules, weekly hours, meal windows, and booking types.',
      href: opsHref('/settings/restaurant/availability#booking-rules'),
      cta: 'Open availability',
      status: availabilityComplete ? 'complete' : 'attention',
      detail: availabilityComplete
        ? 'Open hours and service windows are configured.'
        : 'Set weekly hours and at least one service window.',
      Icon: CalendarClock,
    },
    {
      key: 'tables',
      title: 'Seating capacity',
      description: 'Controls table inventory, active zones, and covers available for bookings.',
      href: opsHref('/settings/restaurant/tables#table-capacity-summary'),
      cta: 'Open tables',
      status: tablesComplete ? 'complete' : 'attention',
      detail: tablesComplete
        ? `${availableTables} service-ready tables are available.`
        : 'Add table numbers and capacity first; zones can come later.',
      Icon: Table2,
    },
    {
      key: 'google',
      title: 'Google Business Profile',
      description: 'Optional import and comparison workflow for public listing details.',
      href: opsHref('/settings/restaurant/google-business-profile#gbp-connection'),
      cta: 'Manage Google',
      status: 'optional',
      detail: 'Useful after the profile and availability basics are ready.',
      Icon: MapPinned,
    },
    {
      key: 'menu',
      title: 'Menu',
      description: 'Optional menu catalogue and Google publishing fields.',
      href: opsHref('/settings/restaurant/menu'),
      cta: 'Open menu',
      status: menuCount > 0 ? 'complete' : 'optional',
      detail:
        menuCount > 0
          ? `${menuCount} menu catalogue entries found.`
          : 'Add later when menus are ready.',
      Icon: Menu,
    },
    {
      key: 'team',
      title: 'Team',
      description: 'Optional staff invitations for reservation and settings access.',
      href: opsHref('/settings/restaurant/team'),
      cta: 'Open team',
      status: pendingInvites > 0 ? 'complete' : 'optional',
      detail:
        pendingInvites > 0
          ? `${pendingInvites} pending invite${pendingInvites === 1 ? '' : 's'}.`
          : 'Invite trusted staff when operations are ready.',
      Icon: Users,
    },
  ];
}
