'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import { useTeamService } from '@/contexts/ops-services';
import { queryKeys } from '@/lib/query/keys';
import { OPS_SETTINGS_STALE_TIME } from '@/lib/query/staleTimes';

import type { HttpError } from '@/lib/http/errors';
import type { CreateInviteInput, TeamInvite, TeamInviteStatus } from '@/services/ops/team';

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

export function useOpsCreateTeamInvite(): UseMutationResult<
  { invite: TeamInvite },
  HttpError | Error,
  CreateInviteInput
> {
  const teamService = useTeamService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input) => teamService.createInvite(input),
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.team.invitationsForRestaurant(result.invite.restaurantId),
        exact: false,
      });
    },
  });
}

export function useOpsRevokeTeamInvite(): UseMutationResult<
  TeamInvite,
  HttpError | Error,
  { restaurantId: string; inviteId: string }
> {
  const teamService = useTeamService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ restaurantId, inviteId }) =>
      teamService.revokeInvite({ restaurantId, inviteId }),
    onSuccess: (invite) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.team.invitationsForRestaurant(invite.restaurantId),
        exact: false,
      });
    },
  });
}
