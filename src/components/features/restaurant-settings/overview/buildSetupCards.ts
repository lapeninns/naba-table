import {
  CalendarClock,
  Compass,
  MapPinned,
  Menu,
  Table2,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react';

import { opsHref } from '@/lib/url/opsHref';

import { AVAILABILITY_ANCHORS, availabilityHash } from '../availabilityAnchors';
import { pluralise } from '../shared/settingsSaveSequence';

/** `unknown` means the check's data did not load, so the status cannot be trusted. */
export type SetupStatus = 'complete' | 'attention' | 'optional' | 'unknown';

type SetupGroup = 'required' | 'optional';

export type SetupCardKey =
  | 'profile'
  | 'availability'
  | 'tables'
  | 'discovery'
  | 'google'
  | 'menu'
  | 'team';

/** One input the completion rule looked at, shown as ✓ (ok) or – (missing). */
type SetupCheck = { label: string; ok: boolean };

export type SetupCard = {
  key: SetupCardKey;
  group: SetupGroup;
  title: string;
  /** One-line reason shown under the title. */
  reason: string;
  href: string;
  cta: string;
  status: SetupStatus;
  /** What the completion rule checked. Empty for rows without a per-input rule. */
  checks: SetupCheck[];
  Icon: LucideIcon;
};

export type ProfileSetupChecks = {
  name: boolean;
  slug: boolean;
  timezone: boolean;
  contactPhone: boolean;
};

export type BuildSetupCardsInput = {
  profileChecks: ProfileSetupChecks;
  openDays: number;
  servicePeriodCount: number;
  totalTables: number;
  availableTables: number;
  menuCount: number;
  pendingInvites: number;
  /** Rows whose checks failed to load. They show "Couldn't check" instead of a status. */
  failedKeys?: ReadonlySet<SetupCardKey>;
};

/** How each row names its check in the "didn't respond" copy. */
const CHECK_NAMES: Record<SetupCardKey, string> = {
  profile: 'profile',
  availability: 'availability',
  tables: 'tables',
  discovery: 'discovery',
  google: 'Google',
  menu: 'menu',
  team: 'team',
};

export function statusLabel(status: SetupStatus) {
  if (status === 'complete') return 'Complete';
  if (status === 'attention') return 'Needs attention';
  if (status === 'unknown') return 'Couldn’t check';
  return 'Optional';
}

function failedCheckReason(key: SetupCardKey) {
  return `The ${CHECK_NAMES[key]} check didn’t respond, so this status may be out of date. Saved settings are unchanged.`;
}

export function summarizeReadiness(cards: SetupCard[]) {
  const required = cards.filter((card) => card.group === 'required');
  const complete = required.filter((card) => card.status === 'complete').length;
  const total = required.length;
  const hasFailedCheck = required.some((card) => card.status === 'unknown');
  const next = required.find((card) => card.status === 'attention') ?? null;
  const ready = complete === total && !hasFailedCheck;

  let title = 'Not ready for bookings yet';
  let description = `${complete} of ${total} required steps complete.`;
  if (hasFailedCheck) {
    title = 'Some checks couldn’t run';
    description = 'Showing the last known status. Try the check again.';
  } else if (ready) {
    title = 'Ready to take bookings';
    description = `${description} Guests can request times on your booking page.`;
  } else if (next) {
    description = `${description} Next: ${next.title.toLowerCase()}.`;
  }

  return {
    complete,
    total,
    ready,
    hasFailedCheck,
    /** The only required step that gets the primary button. */
    nextKey: hasFailedCheck ? null : (next?.key ?? null),
    segments: required.map((card) => card.status === 'complete'),
    title,
    description,
    progressLabel: `${complete} of ${total} required steps complete`,
  };
}

export type ReadinessSummary = ReturnType<typeof summarizeReadiness>;

function withFailure(
  card: SetupCard,
  failedKeys: ReadonlySet<SetupCardKey> | undefined,
): SetupCard {
  if (!failedKeys?.has(card.key)) return card;
  return { ...card, status: 'unknown', reason: failedCheckReason(card.key), checks: [] };
}

export function buildSetupCards({
  profileChecks,
  openDays,
  servicePeriodCount,
  totalTables,
  availableTables,
  menuCount,
  pendingInvites,
  failedKeys,
}: BuildSetupCardsInput): SetupCard[] {
  const profile: SetupCheck[] = [
    { label: 'Restaurant name', ok: profileChecks.name },
    { label: 'Booking page link', ok: profileChecks.slug },
    { label: 'Timezone', ok: profileChecks.timezone },
    { label: 'Public phone', ok: profileChecks.contactPhone },
  ];
  const availability: SetupCheck[] = [
    { label: `${pluralise(openDays, 'day')} open each week`, ok: openDays > 0 },
    { label: `${pluralise(servicePeriodCount, 'meal time')} set`, ok: servicePeriodCount > 0 },
  ];
  const tables: SetupCheck[] = [
    { label: `${pluralise(totalTables, 'table')} added`, ok: totalTables > 0 },
    { label: `${availableTables} bookable now`, ok: availableTables > 0 },
  ];
  const requiredStatus = (checks: SetupCheck[]): SetupStatus =>
    checks.every((check) => check.ok) ? 'complete' : 'attention';

  const cards: SetupCard[] = [
    {
      key: 'profile',
      group: 'required',
      title: 'Public profile',
      reason: 'Guests see this on the booking page and in confirmations.',
      href: opsHref('/settings/restaurant/profile'),
      cta: 'Open profile',
      status: requiredStatus(profile),
      checks: profile,
      Icon: UserRound,
    },
    {
      key: 'availability',
      group: 'required',
      title: 'Booking availability',
      reason: 'Opening hours and meal times decide which times guests can request.',
      href: opsHref(
        `/settings/restaurant/availability${availabilityHash(AVAILABILITY_ANCHORS.weeklyHours)}`,
      ),
      cta: 'Open availability',
      status: requiredStatus(availability),
      checks: availability,
      Icon: CalendarClock,
    },
    {
      key: 'tables',
      group: 'required',
      title: 'Seating capacity',
      reason: 'Only active tables in active zones can be given to bookings.',
      href: opsHref('/settings/restaurant/tables'),
      cta: 'Open tables',
      status: requiredStatus(tables),
      checks: tables,
      Icon: Table2,
    },
    {
      key: 'discovery',
      group: 'optional',
      title: 'Discovery details',
      reason: 'Categories, links and amenities that help guests find and choose you.',
      href: opsHref('/settings/restaurant/discovery'),
      cta: 'Open discovery',
      status: 'optional',
      checks: [],
      Icon: Compass,
    },
    {
      key: 'google',
      group: 'optional',
      title: 'Google Business Profile',
      reason: 'Useful after the profile and availability basics are ready.',
      href: opsHref('/settings/restaurant/google-business-profile'),
      cta: 'Manage Google',
      status: 'optional',
      checks: [],
      Icon: MapPinned,
    },
    {
      key: 'menu',
      group: 'optional',
      title: 'Menu',
      reason:
        menuCount > 0
          ? `${pluralise(menuCount, 'menu catalogue entry', 'menu catalogue entries')} found.`
          : 'Add later when menus are ready.',
      href: opsHref('/settings/restaurant/menu'),
      cta: 'Open menu',
      status: menuCount > 0 ? 'complete' : 'optional',
      checks: [],
      Icon: Menu,
    },
    {
      key: 'team',
      group: 'optional',
      title: 'Team',
      reason:
        pendingInvites > 0
          ? `${pluralise(pendingInvites, 'pending invite')}.`
          : 'Invite trusted staff when operations are ready.',
      href: opsHref('/settings/restaurant/team'),
      cta: 'Open team',
      status: pendingInvites > 0 ? 'complete' : 'optional',
      checks: [],
      Icon: Users,
    },
  ];

  return cards.map((card) => withFailure(card, failedKeys));
}
