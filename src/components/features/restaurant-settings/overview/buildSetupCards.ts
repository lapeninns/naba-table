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
  profileDetail: string;
  availabilityComplete: boolean;
  tablesComplete: boolean;
  availableTables: number;
  menuCount: number;
  pendingInvites: number;
};

const REQUIRED_SETUP_CARD_KEYS = new Set(['profile', 'availability', 'tables']);
const OPTIONAL_SETUP_CARD_KEYS = new Set(['google', 'menu', 'team']);

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

export function summarizeOptionalSetup(cards: SetupCard[]) {
  const optional = cards.filter((card) => OPTIONAL_SETUP_CARD_KEYS.has(card.key));
  const started = optional.filter((card) => card.status === 'complete').length;
  const next = optional.find((card) => card.status !== 'complete');
  const ready = optional
    .filter((card) => card.status === 'complete')
    .map((card) => `${card.title} ready`);
  const pending = optional
    .filter((card) => card.status !== 'complete')
    .map((card) => `${card.title} pending`);

  return {
    total: optional.length,
    started,
    value:
      ready.length > 0
        ? [...ready, ...pending].slice(0, 2).join(' · ')
        : `${started}/${optional.length} started`,
    description: next?.detail ?? 'Optional tools are ready when needed.',
  };
}

export function summarizeRequiredSetup(cards: SetupCard[]) {
  const required = cards.filter((card) => REQUIRED_SETUP_CARD_KEYS.has(card.key));
  const complete = required.filter((card) => card.status === 'complete').length;
  const next = required.find((card) => card.status !== 'complete') ?? null;
  const total = required.length;
  const percent = total > 0 ? Math.round((complete / total) * 100) : 0;

  return {
    complete,
    total,
    percent,
    next,
    title:
      complete === total
        ? 'Your restaurant is ready to take bookings.'
        : `Next up: ${next?.title ?? 'required setup'}`,
    description:
      complete === total
        ? 'Profile, availability, and seating capacity are all ready for guests.'
        : (next?.detail ?? 'Complete the next required setup step before go-live.'),
    footer:
      complete === total
        ? 'All required setup is complete'
        : `${next?.title ?? 'Required setup'} needs attention`,
  };
}

export function buildSetupCards({
  profileComplete,
  profileDetail,
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
      detail: profileDetail,
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
