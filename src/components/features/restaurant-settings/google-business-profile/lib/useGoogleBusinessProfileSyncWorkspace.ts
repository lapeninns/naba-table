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
  buildDirectionSectionSummaries,
  buildDirectionStats,
  buildSelectedApprovalsForDirection,
  buildSelectedItemsForDirection,
  compareBooleanRecords,
  countSelectionsByDirection,
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

export function useGoogleBusinessProfileSyncWorkspace(restaurantId: string) {
  const workflowQuery = useOpsGoogleBusinessProfileWorkflow(restaurantId);
  const updateDraftMutation = useOpsUpdateGoogleBusinessProfileDraft(restaurantId);
  const preflightMutation = useOpsPreflightGoogleBusinessProfileDraftPublish(restaurantId);
  const publishMutation = useOpsPublishGoogleBusinessProfileDraft(restaurantId);
  const retryMutation = useOpsRetryGoogleBusinessProfileDraftGooglePush(restaurantId);

  const draft = workflowQuery.data?.latestDraft ?? null;
  const activePublishJob = workflowQuery.data?.activePublishJob ?? null;

  const [direction, setDirection] = useState<SyncPublishDirection>('google_to_nabatable');
  const [fieldDecisions, setFieldDecisions] = useState<Record<string, FieldDecision>>(() =>
    deriveInitialFieldDecisions(draft),
  );
  const [selectedSectionKey, setSelectedSectionKey] = useState<string | null>(null);
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
    if (activePublishJob?.directionIntent === 'nabatable_to_google') {
      setDirection('nabatable_to_google');
    } else {
      setDirection('google_to_nabatable');
    }

    const currentDraftId = draft?.id ?? null;
    if (previousDraftIdRef.current === currentDraftId) {
      return;
    }

    previousDraftIdRef.current = currentDraftId;
    setFieldDecisions(deriveInitialFieldDecisions(draft));
    setSelectedSectionKey(null);
    setPreflightResult(null);
    setPreflightErrorMessage(null);
    setPublishErrorMessage(null);
    setRetryErrorMessage(null);
  }, [activePublishJob?.directionIntent, draft]);

  const selectedApprovals = useMemo(
    () => buildSelectedApprovalsForDirection(draft, fieldDecisions, direction),
    [draft, fieldDecisions, direction],
  );

  const sectionSummaries = useMemo(
    () => buildDirectionSectionSummaries(draft, fieldDecisions, direction),
    [draft, fieldDecisions, direction],
  );

  const selectedSectionSummary = useMemo(
    () =>
      sectionSummaries.find((summary) => summary.section.sectionKey === selectedSectionKey) ?? null,
    [sectionSummaries, selectedSectionKey],
  );

  const selectedItems = useMemo(
    () => buildSelectedItemsForDirection(draft, fieldDecisions, direction),
    [draft, fieldDecisions, direction],
  );

  const directionStats = useMemo(
    () => buildDirectionStats(draft, fieldDecisions, direction),
    [draft, fieldDecisions, direction],
  );

  const directionCounts = useMemo(
    () => countSelectionsByDirection(draft, fieldDecisions),
    [draft, fieldDecisions],
  );

  const mixedDirectionSelections = useMemo(
    () => hasMixedDirectionSelections(draft, fieldDecisions),
    [draft, fieldDecisions],
  );

  useEffect(() => {
    if (
      selectedSectionKey &&
      sectionSummaries.some((summary) => summary.section.sectionKey === selectedSectionKey)
    ) {
      return;
    }

    setSelectedSectionKey(sectionSummaries[0]?.section.sectionKey ?? null);
  }, [sectionSummaries, selectedSectionKey]);

  const resetPreflight = useCallback(() => {
    setPreflightResult(null);
    setPreflightErrorMessage(null);
    setPublishErrorMessage(null);
    preflightMutation.reset();
  }, [preflightMutation]);

  const updateDecision = useCallback(
    (item: GoogleBusinessProfileDraftItem, decision: FieldDecision) => {
      resetPreflight();
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
      !compareBooleanRecords(draft.selectedApprovals, selectedApprovals);

    if (!needsUpdate) {
      return;
    }

    await updateDraftMutation.mutateAsync({
      draftId: draft.id,
      payload: {
        selectedApprovals,
        status: 'approved',
      },
    });
  }, [draft, selectedApprovals, updateDraftMutation, workflowQuery]);

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
          directionIntent: direction,
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
    direction,
    ensureDraftSelectionsApproved,
    preflightMutation,
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
            idempotencyKey: preflightResult.idempotencyKey,
            selectedApprovals,
            directionIntent: direction,
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
    [direction, draft, preflightResult, publishMutation, selectedApprovals, workflowQuery],
  );

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
    },
    fieldDecisions,
    sectionSummaries,
    selectedSectionSummary,
    selectedSectionKey,
    setSelectedSectionKey,
    directionStats,
    directionCounts,
    mixedDirectionSelections,
    selectedApprovals,
    selectedItems,
    updateDecision,
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
