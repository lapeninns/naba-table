/**
 * Phase 4 of the GBP Dual-Sync V2 architecture.
 *
 * react-query hook for the V2 ops surface. Exposes typed mutations and a
 * single state slice keyed by restaurant + draft. Legacy hook
 * (`useOpsGoogleBusinessProfile`) stays untouched.
 */

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import {
  createSyncV2Draft,
  executeSyncV2Publish,
  getSyncV2Draft,
  retrySyncV2GooglePush,
  runSyncV2Preflight,
  upsertSyncV2Decisions,
} from '@/services/ops/google-business-profile-v2';

import type {
  SyncV2DecisionInput,
  SyncV2DirectionIntent,
} from '@/server/google-business-profile-v2/types';
import type {
  CreateDraftV2Response,
  GetDraftV2Response,
  PreflightV2ErrorResponse,
  PreflightV2Response,
  PublishV2Response,
  UpsertDecisionsV2Response,
} from '@/services/ops/google-business-profile-v2';

const v2QueryKey = (restaurantId: string, draftId: string) =>
  ['gbp-sync-v2-draft', restaurantId, draftId] as const;

export interface UseOpsGoogleBusinessProfileV2Args {
  readonly restaurantId: string | null;
  readonly draftId: string | null;
}

export function useOpsGoogleBusinessProfileV2({
  restaurantId,
  draftId,
}: UseOpsGoogleBusinessProfileV2Args) {
  const queryClient = useQueryClient();

  const enabled = Boolean(restaurantId && draftId);
  const draftQuery = useQuery<GetDraftV2Response>({
    enabled,
    queryKey: enabled
      ? v2QueryKey(restaurantId as string, draftId as string)
      : ['gbp-sync-v2-draft', 'noop'],
    queryFn: () => getSyncV2Draft(restaurantId as string, draftId as string),
  });

  const createDraftMutation = useMutation<
    CreateDraftV2Response,
    Error,
    { readonly refresh?: boolean } | void
  >({
    mutationFn: (options) => {
      if (!restaurantId) {
        return Promise.reject(new Error('restaurantId is required to create a V2 draft'));
      }
      return createSyncV2Draft(restaurantId, { refresh: options?.refresh });
    },
  });

  const upsertDecisionsMutation = useMutation<
    UpsertDecisionsV2Response,
    Error,
    ReadonlyArray<SyncV2DecisionInput>
  >({
    mutationFn: (decisions) => {
      if (!restaurantId || !draftId) {
        return Promise.reject(
          new Error('restaurantId and draftId are required to upsert decisions'),
        );
      }
      return upsertSyncV2Decisions(restaurantId, draftId, decisions);
    },
    onSuccess: () => {
      if (restaurantId && draftId) {
        queryClient.invalidateQueries({ queryKey: v2QueryKey(restaurantId, draftId) });
      }
    },
  });

  const preflightMutation = useMutation<
    PreflightV2Response | PreflightV2ErrorResponse,
    Error,
    SyncV2DirectionIntent
  >({
    mutationFn: (directionIntent) => {
      if (!restaurantId || !draftId) {
        return Promise.reject(new Error('restaurantId and draftId are required to preflight'));
      }
      const idempotencyKey = `v2-${draftId}-${directionIntent}-${Date.now()}`;
      return runSyncV2Preflight(restaurantId, draftId, { directionIntent, idempotencyKey });
    },
  });

  const publishMutation = useMutation<
    PublishV2Response,
    Error,
    { publishJobId: string; confirmPassword: string }
  >({
    mutationFn: (input) => {
      if (!restaurantId || !draftId) {
        return Promise.reject(new Error('restaurantId and draftId are required to publish'));
      }
      return executeSyncV2Publish(restaurantId, draftId, input);
    },
    onSuccess: () => {
      if (restaurantId && draftId) {
        queryClient.invalidateQueries({ queryKey: v2QueryKey(restaurantId, draftId) });
      }
    },
  });

  const retryGooglePushMutation = useMutation<PublishV2Response, Error, string>({
    mutationFn: (jobId) => {
      if (!restaurantId || !draftId) {
        return Promise.reject(new Error('restaurantId and draftId are required to retry'));
      }
      return retrySyncV2GooglePush(restaurantId, draftId, jobId);
    },
  });

  const refresh = useCallback(() => {
    if (restaurantId && draftId) {
      return queryClient.invalidateQueries({ queryKey: v2QueryKey(restaurantId, draftId) });
    }
    return Promise.resolve();
  }, [queryClient, restaurantId, draftId]);

  return {
    draft: draftQuery.data?.draft ?? null,
    decisions: draftQuery.data?.decisions ?? [],
    isLoading: draftQuery.isLoading,
    error: draftQuery.error,
    refresh,
    createDraft: createDraftMutation.mutateAsync,
    upsertDecisions: upsertDecisionsMutation.mutateAsync,
    preflight: preflightMutation.mutateAsync,
    publish: publishMutation.mutateAsync,
    retryGooglePush: retryGooglePushMutation.mutateAsync,
    state: {
      isCreatingDraft: createDraftMutation.isPending,
      isUpsertingDecisions: upsertDecisionsMutation.isPending,
      isPreflighting: preflightMutation.isPending,
      isPublishing: publishMutation.isPending,
      isRetrying: retryGooglePushMutation.isPending,
    },
  };
}
