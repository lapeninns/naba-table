'use client';

import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { z } from 'zod';

import { fetchJson } from '@/lib/http/fetchJson';
import {
  invitationCreatePayloadSchema,
  invitationCreateResponseSchema,
  invitationListResponseSchema,
  type RestaurantInvite,
} from '@/lib/owner/team/schema';
import { queryKeys } from '@/lib/query/keys';

import type { HttpError } from '@/lib/http/errors';


type InvitationStatusFilter = Parameters<typeof queryKeys.team.invitations>[1];

type UseTeamInvitationsArgs = {
  restaurantId?: string;
  status?: InvitationStatusFilter;
  enabled?: boolean;
};

export function useTeamInvitations({
  restaurantId,
  status = 'pending',
  enabled = true,
}: UseTeamInvitationsArgs): UseQueryResult<RestaurantInvite[], HttpError> {
  const resolvedRestaurantId = restaurantId ?? '__unselected__';

  return useQuery<RestaurantInvite[], HttpError>({
    queryKey: queryKeys.team.invitations(resolvedRestaurantId, status),
    enabled: Boolean(restaurantId) && enabled,
    queryFn: async () => {
      if (!restaurantId) {
        return [];
      }
      const search = new URLSearchParams({ restaurantId });
      if (status && status !== 'pending') {
        search.set('status', status);
      }
      const data = await fetchJson<unknown>(`/api/owner/team/invitations?${search.toString()}`);
      const parsed = invitationListResponseSchema.parse(data);
      return parsed.invites;
    },
    staleTime: 60 * 1000,
  });
}

type CreateInviteVariables = ReturnType<typeof invitationCreatePayloadSchema['parse']>;

export function useCreateTeamInvite(): UseMutationResult<
  { invite: RestaurantInvite; token: string; inviteUrl: string },
  HttpError,
  CreateInviteVariables
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables) => {
      const payload = invitationCreatePayloadSchema.parse(variables);
      const data = await fetchJson<unknown>('/api/owner/team/invitations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const parsed = invitationCreateResponseSchema.parse(data);
      return parsed;
    },
    onSuccess: (result, variables) => {
      toast.success('Invitation sent');
      queryClient.invalidateQueries({
        queryKey: queryKeys.team.invitations(variables.restaurantId, 'pending'),
      });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}

type RevokeInviteVariables = {
  restaurantId: string;
  inviteId: string;
};

export function useRevokeTeamInvite(): UseMutationResult<RestaurantInvite, HttpError, RevokeInviteVariables> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ restaurantId, inviteId }) => {
      const search = new URLSearchParams({ restaurantId });
      const data = await fetchJson<unknown>(`/api/owner/team/invitations/${inviteId}?${search.toString()}`, {
        method: 'DELETE',
      });
      const parsed = z
        .object({ invite: invitationListResponseSchema.shape.invites.element })
        .parse(data);
      return parsed.invite;
    },
    onSuccess: (_invite, variables) => {
      toast.success('Invitation revoked');
      queryClient.invalidateQueries({
        queryKey: queryKeys.team.invitations(variables.restaurantId, 'pending'),
      });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}
