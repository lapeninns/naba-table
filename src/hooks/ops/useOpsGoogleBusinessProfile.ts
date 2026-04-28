'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import { useRestaurantService } from '@/contexts/ops-services';
import { queryKeys } from '@/lib/query/keys';
import {
  deriveGoogleBusinessProfileWorkflowStage,
  type GoogleBusinessProfileWorkflowStage,
} from '@/services/ops/restaurants';

import type { HttpError } from '@/lib/http/errors';
import type {
  GoogleBusinessProfileConnection,
  GoogleBusinessProfileDraftPatchPayload,
  GoogleBusinessProfileDraftPublishPayload,
  GoogleBusinessProfileDraftPublishPreflight,
  GoogleBusinessProfileDraftPublishPreflightPayload,
  GoogleBusinessProfileProtectedActionPayload,
  GoogleBusinessProfileWorkflow,
  LinkGoogleBusinessProfileLocationInput,
} from '@/services/ops/restaurants';

export function useOpsGoogleBusinessProfileWorkflowStage(
  restaurantId?: string | null,
): GoogleBusinessProfileWorkflowStage {
  const workflow = useOpsGoogleBusinessProfileWorkflow(restaurantId).data;
  return deriveGoogleBusinessProfileWorkflowStage(workflow);
}

export function useOpsGoogleBusinessProfileConnection(
  restaurantId?: string | null,
): UseQueryResult<GoogleBusinessProfileConnection, HttpError> {
  const restaurantService = useRestaurantService();

  return useQuery<GoogleBusinessProfileConnection, HttpError>({
    queryKey: restaurantId
      ? queryKeys.opsRestaurants.googleBusinessProfile(restaurantId)
      : queryKeys.opsRestaurants.googleBusinessProfile('none'),
    queryFn: () => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return restaurantService.getGoogleBusinessProfileConnection(restaurantId);
    },
    enabled: Boolean(restaurantId),
    staleTime: 30_000,
  });
}

export function useOpsLinkGoogleBusinessProfileLocation(
  restaurantId?: string | null,
): UseMutationResult<
  GoogleBusinessProfileConnection,
  HttpError | Error,
  LinkGoogleBusinessProfileLocationInput
> {
  const restaurantService = useRestaurantService();
  const queryClient = useQueryClient();

  return useMutation<
    GoogleBusinessProfileConnection,
    HttpError | Error,
    LinkGoogleBusinessProfileLocationInput
  >({
    mutationFn: (payload) => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return restaurantService.linkGoogleBusinessProfileLocation(restaurantId, payload);
    },
    onSuccess: (state) => {
      if (!restaurantId) return;
      queryClient.setQueryData(queryKeys.opsRestaurants.googleBusinessProfile(restaurantId), state);
    },
  });
}

export function useOpsDisconnectGoogleBusinessProfile(
  restaurantId?: string | null,
): UseMutationResult<GoogleBusinessProfileConnection, HttpError | Error, void> {
  const restaurantService = useRestaurantService();
  const queryClient = useQueryClient();

  return useMutation<GoogleBusinessProfileConnection, HttpError | Error, void>({
    mutationFn: () => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return restaurantService.disconnectGoogleBusinessProfileConnection(restaurantId);
    },
    onSuccess: (state) => {
      if (!restaurantId) return;
      queryClient.setQueryData(queryKeys.opsRestaurants.googleBusinessProfile(restaurantId), state);
    },
  });
}

export function useOpsSyncGoogleBusinessProfile(
  restaurantId?: string | null,
): UseMutationResult<
  GoogleBusinessProfileConnection,
  HttpError | Error,
  GoogleBusinessProfileProtectedActionPayload
> {
  const restaurantService = useRestaurantService();
  const queryClient = useQueryClient();

  return useMutation<
    GoogleBusinessProfileConnection,
    HttpError | Error,
    GoogleBusinessProfileProtectedActionPayload
  >({
    mutationFn: (payload) => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return restaurantService.syncGoogleBusinessProfileBusinessInfo(restaurantId, payload);
    },
    onSuccess: (state) => {
      if (!restaurantId) return;
      queryClient.setQueryData(queryKeys.opsRestaurants.googleBusinessProfile(restaurantId), state);
    },
  });
}

export function useOpsGoogleBusinessProfileWorkflow(
  restaurantId?: string | null,
): UseQueryResult<GoogleBusinessProfileWorkflow, HttpError> {
  const restaurantService = useRestaurantService();

  return useQuery<GoogleBusinessProfileWorkflow, HttpError>({
    queryKey: restaurantId
      ? [...queryKeys.opsRestaurants.googleBusinessProfile(restaurantId), 'workflow']
      : [...queryKeys.opsRestaurants.googleBusinessProfile('none'), 'workflow'],
    queryFn: () => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return restaurantService.getGoogleBusinessProfileWorkflow(restaurantId);
    },
    enabled: Boolean(restaurantId),
    staleTime: 15_000,
  });
}

export function useOpsCreateGoogleBusinessProfileDraft(
  restaurantId?: string | null,
): UseMutationResult<GoogleBusinessProfileWorkflow, HttpError | Error, void> {
  const restaurantService = useRestaurantService();
  const queryClient = useQueryClient();

  return useMutation<GoogleBusinessProfileWorkflow, HttpError | Error, void>({
    mutationFn: () => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return restaurantService.createGoogleBusinessProfileDraft(restaurantId);
    },
    onSuccess: (workflow) => {
      if (!restaurantId) return;
      queryClient.setQueryData(
        [...queryKeys.opsRestaurants.googleBusinessProfile(restaurantId), 'workflow'],
        workflow,
      );
      void queryClient.invalidateQueries({
        queryKey: queryKeys.opsRestaurants.googleBusinessProfile(restaurantId),
      });
    },
  });
}

export function useOpsUpdateGoogleBusinessProfileDraft(
  restaurantId?: string | null,
): UseMutationResult<
  GoogleBusinessProfileWorkflow,
  HttpError | Error,
  { draftId: string; payload: GoogleBusinessProfileDraftPatchPayload }
> {
  const restaurantService = useRestaurantService();
  const queryClient = useQueryClient();

  return useMutation<
    GoogleBusinessProfileWorkflow,
    HttpError | Error,
    { draftId: string; payload: GoogleBusinessProfileDraftPatchPayload }
  >({
    mutationFn: ({ draftId, payload }) => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return restaurantService.updateGoogleBusinessProfileDraft(restaurantId, draftId, payload);
    },
    onSuccess: (workflow) => {
      if (!restaurantId) return;
      queryClient.setQueryData(
        [...queryKeys.opsRestaurants.googleBusinessProfile(restaurantId), 'workflow'],
        workflow,
      );
    },
  });
}

export function useOpsPublishGoogleBusinessProfileDraft(
  restaurantId?: string | null,
): UseMutationResult<
  GoogleBusinessProfileWorkflow,
  HttpError | Error,
  { draftId: string; payload: GoogleBusinessProfileDraftPublishPayload }
> {
  const restaurantService = useRestaurantService();
  const queryClient = useQueryClient();

  return useMutation<
    GoogleBusinessProfileWorkflow,
    HttpError | Error,
    { draftId: string; payload: GoogleBusinessProfileDraftPublishPayload }
  >({
    mutationFn: ({ draftId, payload }) => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return restaurantService.publishGoogleBusinessProfileDraft(restaurantId, draftId, payload);
    },
    onSuccess: (workflow) => {
      if (!restaurantId) return;
      queryClient.setQueryData(
        [...queryKeys.opsRestaurants.googleBusinessProfile(restaurantId), 'workflow'],
        workflow,
      );
      void queryClient.invalidateQueries({
        queryKey: queryKeys.opsRestaurants.googleBusinessProfile(restaurantId),
      });
    },
  });
}

export function useOpsPreflightGoogleBusinessProfileDraftPublish(
  restaurantId?: string | null,
): UseMutationResult<
  GoogleBusinessProfileDraftPublishPreflight,
  HttpError | Error,
  { draftId: string; payload: GoogleBusinessProfileDraftPublishPreflightPayload }
> {
  const restaurantService = useRestaurantService();

  return useMutation<
    GoogleBusinessProfileDraftPublishPreflight,
    HttpError | Error,
    { draftId: string; payload: GoogleBusinessProfileDraftPublishPreflightPayload }
  >({
    mutationFn: ({ draftId, payload }) => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return restaurantService.preflightGoogleBusinessProfileDraftPublish(
        restaurantId,
        draftId,
        payload,
      );
    },
  });
}

export function useOpsRetryGoogleBusinessProfileDraftGooglePush(
  restaurantId?: string | null,
): UseMutationResult<
  GoogleBusinessProfileWorkflow,
  HttpError | Error,
  { draftId: string; publishJobId: string; payload: GoogleBusinessProfileProtectedActionPayload }
> {
  const restaurantService = useRestaurantService();
  const queryClient = useQueryClient();

  return useMutation<
    GoogleBusinessProfileWorkflow,
    HttpError | Error,
    { draftId: string; publishJobId: string; payload: GoogleBusinessProfileProtectedActionPayload }
  >({
    mutationFn: ({ draftId, publishJobId, payload }) => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return restaurantService.retryGoogleBusinessProfileDraftGooglePush(
        restaurantId,
        draftId,
        publishJobId,
        payload,
      );
    },
    onSuccess: (workflow) => {
      if (!restaurantId) return;
      queryClient.setQueryData(
        [...queryKeys.opsRestaurants.googleBusinessProfile(restaurantId), 'workflow'],
        workflow,
      );
      void queryClient.invalidateQueries({
        queryKey: queryKeys.opsRestaurants.googleBusinessProfile(restaurantId),
      });
    },
  });
}
