'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  useOpsGoogleBusinessProfileWorkflow,
  useOpsPreflightGoogleBusinessProfileDraftPublish,
  useOpsPublishGoogleBusinessProfileDraft,
  useOpsRetryGoogleBusinessProfileDraftGooglePush,
  useOpsUpdateGoogleBusinessProfileDraft,
} from '@/hooks/ops/useOpsGoogleBusinessProfile';
import { HttpError } from '@/lib/http/errors';

import {
  buildConflictSectionSummaries,
  buildConflictStats,
  buildDirectionSectionSummaries,
  buildDirectionStats,
  buildFieldDecisionPayload,
  buildSelectedApprovalsForDecisions,
  buildSelectedItemsForDecisions,
  countSelectionsByDirection,
  decisionDirection,
  deriveInitialFieldDecisions,
  getFieldDecision,
  hasMixedDirectionSelections,
  isReadOnlyReviewStatus,
  type FieldDecision,
  type SyncPublishDirection,
} from './sync-review';

import type {
  GoogleBusinessProfileDraftItem,
  GoogleBusinessProfileDraftPublishPreflight,
} from '@/services/ops/restaurants';

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function shouldRefreshWorkflow(error: unknown): boolean {
  return (
    error instanceof HttpError &&
    [
      'GBP_DRAFT_STALE',
      'GBP_DRAFT_INVALID_STATE',
      'GBP_DRAFT_NOT_APPROVED',
      'GBP_PUBLISH_JOB_INVALID_STATE',
      'GBP_PUBLISH_JOB_MISMATCH',
    ].includes(error.code)
  );
}

export function useGoogleBusinessProfileSyncWorkspace(
  restaurantId: string,
  googlePushEnabled = true,
) {
  const workflowQuery = useOpsGoogleBusinessProfileWorkflow(restaurantId);
  const updateDraftMutation = useOpsUpdateGoogleBusinessProfileDraft(restaurantId);
  const preflightMutation = useOpsPreflightGoogleBusinessProfileDraftPublish(restaurantId);
  const publishMutation = useOpsPublishGoogleBusinessProfileDraft(restaurantId);
  const retryMutation = useOpsRetryGoogleBusinessProfileDraftGooglePush(restaurantId);

  const draft = workflowQuery.data?.latestDraft ?? null;
  const activePublishJob = workflowQuery.data?.activePublishJob ?? null;

  const [direction, setDirection] = useState<SyncPublishDirection>('google_to_nabatable');
  const [reviewDirection, setReviewDirection] =
    useState<SyncPublishDirection>('google_to_nabatable');
  const [fieldDecisions, setFieldDecisions] = useState<Record<string, FieldDecision>>(() =>
    deriveInitialFieldDecisions(draft),
  );
  const [preflightDialogOpen, setPreflightDialogOpen] = useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [retryDialogOpen, setRetryDialogOpen] = useState(false);
  const [preflightResult, setPreflightResult] =
    useState<GoogleBusinessProfileDraftPublishPreflight | null>(null);
  const [preflightErrorMessage, setPreflightErrorMessage] = useState<string | null>(null);
  const [publishErrorMessage, setPublishErrorMessage] = useState<string | null>(null);
  const [retryErrorMessage, setRetryErrorMessage] = useState<string | null>(null);

  const previousDraftIdRef = useRef<string | null>(draft?.id ?? null);

  useEffect(() => {
    const currentDraftId = draft?.id ?? null;
    const jobDirection =
      activePublishJob?.directionIntent === 'nabatable_to_google'
        ? 'nabatable_to_google'
        : activePublishJob?.directionIntent
          ? 'google_to_nabatable'
          : null;

    if (previousDraftIdRef.current !== currentDraftId) {
      const initialDirection = jobDirection ?? 'google_to_nabatable';
      setDirection(initialDirection);
      setReviewDirection(initialDirection);
      previousDraftIdRef.current = currentDraftId;
      setFieldDecisions(deriveInitialFieldDecisions(draft));
      setPreflightResult(null);
      setPreflightErrorMessage(null);
      setPublishErrorMessage(null);
      setRetryErrorMessage(null);
      return;
    }

    if (jobDirection) {
      setDirection(jobDirection);
      setReviewDirection(jobDirection);
    }
  }, [activePublishJob?.directionIntent, draft]);

  const selectedApprovals = useMemo(
    () => buildSelectedApprovalsForDecisions(draft, fieldDecisions),
    [draft, fieldDecisions],
  );

  const decisionPayload = useMemo(
    () => buildFieldDecisionPayload(draft, fieldDecisions),
    [draft, fieldDecisions],
  );

  const sectionSummaries = useMemo(
    () => buildDirectionSectionSummaries(draft, fieldDecisions, direction),
    [draft, fieldDecisions, direction],
  );

  const directionStats = useMemo(
    () => buildDirectionStats(draft, fieldDecisions, direction),
    [draft, fieldDecisions, direction],
  );

  const conflictStats = useMemo(
    () => buildConflictStats(draft, fieldDecisions, googlePushEnabled),
    [draft, fieldDecisions, googlePushEnabled],
  );

  const conflictSectionSummaries = useMemo(
    () => buildConflictSectionSummaries(draft, fieldDecisions, googlePushEnabled),
    [draft, fieldDecisions, googlePushEnabled],
  );

  const selectedItems = useMemo(
    () => buildSelectedItemsForDecisions(draft, fieldDecisions),
    [draft, fieldDecisions],
  );

  const directionCounts = useMemo(
    () => countSelectionsByDirection(draft, fieldDecisions),
    [draft, fieldDecisions],
  );

  const mixedDirectionSelections = useMemo(
    () => hasMixedDirectionSelections(draft, fieldDecisions),
    [draft, fieldDecisions],
  );

  const resetPreflight = useCallback(() => {
    setPreflightResult(null);
    setPreflightErrorMessage(null);
    setPublishErrorMessage(null);
    preflightMutation.reset();
  }, [preflightMutation]);

  const updateDecision = useCallback(
    (item: GoogleBusinessProfileDraftItem, decision: FieldDecision) => {
      resetPreflight();
      const nextDirection = decisionDirection(decision);
      if (nextDirection) {
        setDirection(nextDirection);
        setReviewDirection(nextDirection);
      }
      setFieldDecisions((current) => ({
        ...current,
        [item.fieldKey]: decision,
      }));
    },
    [resetPreflight],
  );

  const ensureDraftSelectionsApproved = useCallback(async () => {
    if (!draft) {
      throw new Error('Generate a workflow draft before continuing.');
    }

    if (isReadOnlyReviewStatus(draft.status)) {
      await workflowQuery.refetch();
      throw new Error(
        'This Google Business Profile review has already been applied. Check for changes again before continuing.',
      );
    }

    const needsUpdate =
      draft.status !== 'approved' ||
      JSON.stringify((draft.decisions ?? []).map((decision) => decision.action)) !==
        JSON.stringify(decisionPayload.map((decision) => decision.action));

    if (!needsUpdate) {
      return;
    }

    await updateDraftMutation.mutateAsync({
      draftId: draft.id,
      payload: {
        selectedApprovals,
        decisions: decisionPayload,
        status: 'approved',
      },
    });
  }, [decisionPayload, draft, selectedApprovals, updateDraftMutation, workflowQuery]);

  const runPreflight = useCallback(async () => {
    if (!draft) {
      throw new Error('Generate a workflow draft before continuing.');
    }

    setPreflightErrorMessage(null);
    setPublishErrorMessage(null);

    try {
      await ensureDraftSelectionsApproved();
      const result = await preflightMutation.mutateAsync({
        draftId: draft.id,
        payload: {
          selectedApprovals,
          decisions: decisionPayload,
          directionIntent: reviewDirection,
        },
      });
      setPreflightResult(result);
      return result;
    } catch (error) {
      if (shouldRefreshWorkflow(error)) {
        void workflowQuery.refetch();
      }
      setPreflightErrorMessage(
        errorMessage(error, 'Unable to run the final Google Business Profile check.'),
      );
      throw error;
    }
  }, [
    draft,
    decisionPayload,
    ensureDraftSelectionsApproved,
    preflightMutation,
    reviewDirection,
    selectedApprovals,
    workflowQuery,
  ]);

  const publishWithPassword = useCallback(
    async (password: string) => {
      if (!draft || !preflightResult) {
        throw new Error('Run the final check before applying changes.');
      }

      setPublishErrorMessage(null);

      try {
        if (isReadOnlyReviewStatus(draft.status)) {
          await workflowQuery.refetch();
          throw new Error(
            'This Google Business Profile review has already been applied. Check for changes again before continuing.',
          );
        }

        await publishMutation.mutateAsync({
          draftId: draft.id,
          payload: {
            password,
            publishJobId: preflightResult.publishJobId,
            publishPlanId: preflightResult.publishPlanId,
            idempotencyKey: preflightResult.idempotencyKey,
            selectedApprovals,
            decisions: decisionPayload,
            directionIntent: preflightResult.directionIntent,
          },
        });
        setPublishDialogOpen(false);
        setPreflightDialogOpen(false);
        setPreflightResult(null);
        await workflowQuery.refetch();
      } catch (error) {
        if (shouldRefreshWorkflow(error)) {
          void workflowQuery.refetch();
        }
        const message = errorMessage(error, 'Unable to publish Google Business Profile changes.');
        setPublishErrorMessage(message);
        throw error;
      }
    },
    [decisionPayload, draft, preflightResult, publishMutation, selectedApprovals, workflowQuery],
  );

  const beginReview = useCallback(() => {
    resetPreflight();

    const nextDirection =
      countSelectionsByDirection(draft, fieldDecisions).google_to_nabatable > 0
        ? 'google_to_nabatable'
        : 'nabatable_to_google';

    setDirection(nextDirection);
    setReviewDirection(nextDirection);
    setPreflightDialogOpen(true);
  }, [draft, fieldDecisions, resetPreflight]);

  const retryGooglePushWithPassword = useCallback(
    async (password: string) => {
      if (!draft || !activePublishJob) {
        throw new Error('No retryable Google push is available.');
      }

      setRetryErrorMessage(null);

      try {
        await retryMutation.mutateAsync({
          draftId: draft.id,
          publishJobId: activePublishJob.id,
          payload: { password },
        });
        setRetryDialogOpen(false);
        await workflowQuery.refetch();
      } catch (error) {
        if (shouldRefreshWorkflow(error)) {
          void workflowQuery.refetch();
        }
        const message = errorMessage(error, 'Unable to retry the Google push.');
        setRetryErrorMessage(message);
        throw error;
      }
    },
    [activePublishJob, draft, retryMutation, workflowQuery],
  );

  return {
    workflowQuery,
    draft,
    activePublishJob,
    direction,
    setDirection: (value: SyncPublishDirection) => {
      resetPreflight();
      setDirection(value);
      setReviewDirection(value);
    },
    reviewDirection,
    setReviewDirection: (value: SyncPublishDirection) => {
      resetPreflight();
      setDirection(value);
      setReviewDirection(value);
    },
    fieldDecisions,
    sectionSummaries,
    conflictSectionSummaries,
    directionStats,
    conflictStats,
    directionCounts,
    mixedDirectionSelections,
    selectedApprovals,
    selectedItems,
    updateDecision,
    beginReview,
    getDecisionForItem: (item: GoogleBusinessProfileDraftItem) =>
      getFieldDecision(item, fieldDecisions),
    preflightDialogOpen,
    setPreflightDialogOpen,
    preflightResult,
    resetPreflight,
    runPreflight,
    preflightMutation,
    preflightErrorMessage,
    publishDialogOpen,
    setPublishDialogOpen,
    publishErrorMessage,
    publishMutation,
    publishWithPassword,
    retryDialogOpen,
    setRetryDialogOpen,
    retryErrorMessage,
    retryMutation,
    retryGooglePushWithPassword,
  };
}
