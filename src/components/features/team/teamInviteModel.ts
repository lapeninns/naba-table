import { format } from 'date-fns';
import { z } from 'zod';

import { getSettingsSaveReasonCode } from '@/components/features/restaurant-settings/shared/settingsSaveSequence';
import { HttpError } from '@/lib/http/errors';
import { RESTAURANT_ROLE_OPTIONS, type RestaurantRole } from '@/lib/owner/auth/roles';

import type { TeamInvite } from '@/services/ops/team';

/** The one status shown for an invitation. A pending invite past its expiry is `expired`. */
export type TeamInviteDisplayStatus = 'pending' | 'expired' | 'accepted' | 'revoked';

export type TeamInviteFilter = TeamInviteDisplayStatus | 'all';

export const TEAM_INVITE_FILTERS: { value: TeamInviteFilter; label: string }[] = [
  { value: 'pending', label: 'Waiting' },
  { value: 'expired', label: 'Expired' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'revoked', label: 'Revoked' },
  { value: 'all', label: 'All' },
];

export const TEAM_INVITE_STATUS_LABELS: Record<TeamInviteDisplayStatus, string> = {
  pending: 'Waiting to be accepted',
  expired: 'Expired',
  accepted: 'Accepted',
  revoked: 'Revoked',
};

export const TEAM_INVITE_ROLE_OPTIONS: { value: RestaurantRole; label: string }[] = [
  { value: 'manager', label: 'Manager' },
  { value: 'host', label: 'Host' },
  { value: 'server', label: 'Server' },
];

/**
 * What each role can do, restating the existing role rules (`lib/owner/auth/roles.ts`).
 * Server has no documented description yet: the product owner must confirm the wording.
 */
export const TEAM_ROLE_DESCRIPTIONS: Record<RestaurantRole, string> = {
  owner: 'Full access, including settings and inviting any role.',
  manager: 'Manages settings, bookings and the team. Can invite managers, hosts and servers.',
  host: 'Manages bookings and guest communication. Can’t change settings or invite people.',
  server: 'Staff access for service.',
};

export const TEAM_ROLE_ORDER: RestaurantRole[] = ['owner', 'manager', 'host', 'server'];

export const TEAM_INVITE_DUPLICATE_MESSAGE = 'This person already has an invitation waiting';

export const teamInviteFormSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Enter an email address')
    .email('Enter a valid email address, e.g. name@example.com'),
  role: z.enum(RESTAURANT_ROLE_OPTIONS),
});

export type TeamInviteFormValues = z.infer<typeof teamInviteFormSchema>;

export function formatTeamRole(role: RestaurantRole): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

/** "an Owner" / "a Manager": for the page's access line. */
export function formatTeamRoleWithArticle(role: RestaurantRole): string {
  const label = formatTeamRole(role);
  return /^[AEIOU]/.test(label) ? `an ${label}` : `a ${label}`;
}

/** "30 Sep 2026". */
export function formatTeamInviteDate(value: string | null | undefined): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return format(parsed, 'd MMM yyyy');
}

export function getTeamInviteDisplayStatus(
  invite: TeamInvite,
  now = Date.now(),
): TeamInviteDisplayStatus {
  if (invite.status === 'pending' && new Date(invite.expiresAt).getTime() < now) {
    return 'expired';
  }
  return invite.status;
}

type TeamInviteCounts = Record<TeamInviteFilter, number>;

export function countTeamInvites(invites: TeamInvite[], now = Date.now()): TeamInviteCounts {
  const counts: TeamInviteCounts = { pending: 0, expired: 0, accepted: 0, revoked: 0, all: 0 };
  for (const invite of invites) {
    counts[getTeamInviteDisplayStatus(invite, now)] += 1;
    counts.all += 1;
  }
  return counts;
}

export type TeamInviteRow = {
  invite: TeamInvite;
  status: TeamInviteDisplayStatus;
};

/** Invitations matching the filter, newest first. */
export function filterTeamInvites(
  invites: TeamInvite[],
  filter: TeamInviteFilter,
  now = Date.now(),
): TeamInviteRow[] {
  return invites
    .map((invite) => ({ invite, status: getTeamInviteDisplayStatus(invite, now) }))
    .filter((row) => filter === 'all' || row.status === filter)
    .sort((a, b) => b.invite.createdAt.localeCompare(a.invite.createdAt));
}

export function hasWaitingTeamInvite(
  invites: readonly TeamInvite[],
  email: string,
  now = Date.now(),
): boolean {
  const normalised = email.trim().toLowerCase();
  if (!normalised) return false;
  return invites.some(
    (invite) =>
      invite.email.toLowerCase() === normalised &&
      getTeamInviteDisplayStatus(invite, now) === 'pending',
  );
}

export type TeamInviteFailure = {
  message: string;
  code: string;
};

/**
 * Safe copy for a failed invitation. Routes return `{ error }`, so the HttpError message is only
 * the status text: the copy is chosen from the code and the code itself is shown.
 */
export function describeTeamInviteFailure(error: unknown): TeamInviteFailure {
  const code = getSettingsSaveReasonCode(error);
  const status = error instanceof HttpError ? error.status : null;

  if (code === 'RATE_LIMITED' || status === 429) {
    return {
      message: 'Too many invitations sent recently. Try again in about 10 minutes.',
      code,
    };
  }
  if (status === 409) {
    return { message: `${TEAM_INVITE_DUPLICATE_MESSAGE}.`, code };
  }
  if (status === 403) {
    return { message: 'Your role can’t send this invitation.', code };
  }
  if (status === 422) {
    return { message: 'This role can’t be invited.', code };
  }
  return { message: 'Nabatable couldn’t send the invitation. Try again.', code };
}
