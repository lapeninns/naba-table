'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import { useTeamService } from '@/contexts/ops-services';
import { HttpError } from '@/lib/http/errors';
import { queryKeys } from '@/lib/query/keys';
import { OPS_SETTINGS_STALE_TIME } from '@/lib/query/staleTimes';

import type {
  CreateInviteInput,
  ResendInviteInput,
  RevokeInviteInput,
  TeamInvite,
  TeamInviteMutationResult,
  TeamInviteStatus,
} from '@/services/ops/team';

export function useOpsTeamInvitations(params: {
  restaurantId?: string | null;
  status?: TeamInviteStatus;
}): UseQueryResult<TeamInvite[], HttpError> {
  const teamService = useTeamService();
  const { restaurantId, status = 'pending' } = params;

  return useQuery<TeamInvite[], HttpError>({
    queryKey: restaurantId
      ? queryKeys.team.invitations(restaurantId, status)
      : queryKeys.team.invitations('none', status),
    queryFn: ({ signal }) => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return teamService.listInvites(restaurantId, status, { signal });
    },
    enabled: Boolean(restaurantId),
    staleTime: OPS_SETTINGS_STALE_TIME.teamInvitations,
    // Invitee emails are PII; keep them out of the localStorage query cache
    // (see lib/query/persist.ts).
    meta: { persist: false },
  });
}

/** Error copy shared by the row actions, keyed by the C1 codes of the invitation routes. */
export const TEAM_INVITE_ACTION_ERROR_COPY: Partial<Record<string, string>> = {
  INVITE_NOT_PENDING: 'This invitation was already accepted, revoked or expired.',
  INVITE_NOT_FOUND: 'This invitation no longer exists.',
  INVITE_EXPIRED: 'This invitation has expired. Send a new invitation instead.',
  INVITE_EMAIL_FAILED: 'The invitation email couldn’t be sent. Try again in a moment.',
  INVITE_EMAIL_SUPPRESSED:
    'This address isn’t accepting email from us, so the invitation couldn’t be delivered.',
  TEAM_INVITES_FORBIDDEN: 'Only owners and managers can manage invitations.',
  RATE_LIMITED: 'This invitation was sent several times recently. Try again in about 10 minutes.',
};

function inviteEmailOf(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const invite = 'invite' in data ? (data as { invite: unknown }).invite : data;
  if (invite && typeof invite === 'object' && 'email' in invite) {
    const email = (invite as { email: unknown }).email;
    return typeof email === 'string' ? email : null;
  }
  return null;
}

function listIncludes(status: unknown, invite: TeamInvite): boolean {
  return status === 'all' || status === invite.status;
}

/**
 * Writes the server's canonical invite into every cached invitation list of its restaurant:
 * replaced in place, added to the top of lists it now belongs to, removed from lists it left.
 * Only this invite changed on the server, so nothing is refetched.
 */
export function applyInviteToCachedLists(queryClient: QueryClient, invite: TeamInvite): void {
  const cached = queryClient.getQueriesData<TeamInvite[]>({
    queryKey: queryKeys.team.invitationsForRestaurant(invite.restaurantId),
  });
  for (const [queryKey, list] of cached) {
    if (!list) continue;
    const belongs = listIncludes(queryKey[3], invite);
    const index = list.findIndex((item) => item.id === invite.id);
    let next: TeamInvite[] = list;
    if (index >= 0) {
      next = belongs
        ? list.map((item) => (item.id === invite.id ? invite : item))
        : list.filter((item) => item.id !== invite.id);
    } else if (belongs) {
      next = [invite, ...list];
    }
    if (next !== list) {
      queryClient.setQueryData(queryKey, next);
    }
  }
}

/** A 404/409 on a row action means the cached list is stale: reload this restaurant's lists. */
function refreshIfStale(queryClient: QueryClient, error: unknown, restaurantId: string): void {
  if (error instanceof HttpError && (error.status === 404 || error.status === 409)) {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.team.invitationsForRestaurant(restaurantId),
    });
  }
}

/**
 * Creates an invitation. The form reports the outcome inline, including `emailSent: false`
 * (the invite exists but its email didn't go out), so there is no toast here.
 */
export function useOpsCreateTeamInvite(): UseMutationResult<
  TeamInviteMutationResult,
  HttpError | Error,
  CreateInviteInput
> {
  const teamService = useTeamService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input) => teamService.createInvite(input),
    meta: { feedback: { error: false } },
    onSuccess: (result) => {
      applyInviteToCachedLists(queryClient, result.invite);
    },
  });
}

export function useOpsRevokeTeamInvite(): UseMutationResult<
  TeamInvite,
  HttpError | Error,
  RevokeInviteInput
> {
  const teamService = useTeamService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ restaurantId, inviteId }) =>
      teamService.revokeInvite({ restaurantId, inviteId }),
    meta: {
      feedback: {
        success: (data) => {
          const email = inviteEmailOf(data);
          return email ? `Invitation for ${email} revoked.` : 'Invitation revoked.';
        },
        error: {
          copy: TEAM_INVITE_ACTION_ERROR_COPY,
          fallback: 'The invitation wasn’t revoked. Try again.',
        },
      },
    },
    onSuccess: (invite) => {
      applyInviteToCachedLists(queryClient, invite);
    },
    onError: (error, variables) => {
      refreshIfStale(queryClient, error, variables.restaurantId);
    },
  });
}

/** Re-sends a pending invitation with a fresh link. The previous link stops working. */
export function useOpsResendTeamInvite(): UseMutationResult<
  TeamInviteMutationResult,
  HttpError | Error,
  ResendInviteInput
> {
  const teamService = useTeamService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input) => teamService.resendInvite(input),
    meta: {
      feedback: {
        success: (data) => {
          const email = inviteEmailOf(data);
          return email ? `Invitation sent again to ${email}.` : 'Invitation sent again.';
        },
        error: {
          copy: TEAM_INVITE_ACTION_ERROR_COPY,
          fallback: 'The invitation wasn’t sent again. Try again.',
        },
      },
    },
    onSuccess: (result) => {
      applyInviteToCachedLists(queryClient, result.invite);
    },
    onError: (error, variables) => {
      refreshIfStale(queryClient, error, variables.restaurantId);
    },
  });
}
