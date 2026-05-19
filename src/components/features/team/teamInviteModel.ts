import { format } from 'date-fns';
import { z } from 'zod';

import { RESTAURANT_ROLE_OPTIONS, type RestaurantRole } from '@/lib/owner/auth/roles';

import type { TeamInvite, TeamInviteStatus } from '@/services/ops/team';

export type TeamInviteStatusBadgeVariant = 'default' | 'outline' | 'secondary';

export const TEAM_INVITE_STATUS_OPTIONS: TeamInviteStatus[] = [
  'pending',
  'accepted',
  'revoked',
  'expired',
  'all',
];

export const TEAM_INVITE_STATUS_LABELS: Record<TeamInviteStatus, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  revoked: 'Revoked',
  expired: 'Expired',
  all: 'All',
};

export const TEAM_INVITE_ROLE_OPTIONS: { value: RestaurantRole; label: string }[] = [
  { value: 'manager', label: 'Manager' },
  { value: 'host', label: 'Host' },
  { value: 'server', label: 'Server' },
];

export const teamInviteFormSchema = z.object({
  email: z.string().trim().min(1, 'Enter an email address').email('Enter a valid email'),
  role: z.enum(RESTAURANT_ROLE_OPTIONS),
});

export type TeamInviteFormValues = z.infer<typeof teamInviteFormSchema>;

export type TeamInviteRow = {
  invite: TeamInvite;
  expiresLabel: string;
  createdLabel: string;
  isExpiredPending: boolean;
};

export function formatTeamInviteTimestamp(value: string | null): string {
  if (!value) return '—';
  return format(new Date(value), 'MMM d, yyyy • HH:mm');
}

export function formatTeamRole(role: RestaurantRole): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function getTeamInviteStatusLabel(status: TeamInviteStatus): string {
  return TEAM_INVITE_STATUS_LABELS[status] ?? status;
}

export function getTeamInviteStatusBadgeVariant(
  status: TeamInviteStatus,
): TeamInviteStatusBadgeVariant {
  if (status === 'pending') return 'secondary';
  if (status === 'accepted') return 'default';
  return 'outline';
}

export function isPendingInviteExpired(invite: TeamInvite, now = Date.now()): boolean {
  return invite.status === 'pending' && new Date(invite.expiresAt).getTime() < now;
}

export function buildTeamInviteRows(invites: TeamInvite[], now = Date.now()): TeamInviteRow[] {
  return invites.map((invite) => ({
    invite,
    expiresLabel: formatTeamInviteTimestamp(invite.expiresAt),
    createdLabel: formatTeamInviteTimestamp(invite.createdAt),
    isExpiredPending: isPendingInviteExpired(invite, now),
  }));
}
