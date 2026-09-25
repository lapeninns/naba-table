'use client';

import { useCallback, useState } from 'react';

import { buildDualSyncPublishPreviewReadiness } from '../dualSyncPublishRequestDomain';
import { getDualSyncErrorMessage } from '../dualSyncShellActionDomain';

import type { DualSyncToastIntent } from '../dualSyncShellActionDomain';
import type { DualSyncDecisionEntry } from '../dualSyncWorkspaceDecisionDomain';
import type { GbpExactPublishConfirmation } from '../GbpExactPublishDialog';
import type { DualSyncWorkspace } from './useDualSyncWorkspace';
import type {
  DualSyncPublishRequest,
  GbpExactPreviewResponseV1,
  GbpPublishResponseV1,
} from '@/services/ops/dual-sync';

interface PendingExactPreview {
  readonly request: DualSyncPublishRequest;
  readonly preview: GbpExactPreviewResponseV1;
}

export function useDualSyncExactPublishActions({
  workspace,
  decisions,
  syncPaused,
  pauseReason,
  canSubmit,
  showToast,
}: {
  readonly workspace: DualSyncWorkspace;
  /** The draft decisions to publish; defaults to every draft decision. */
  readonly decisions?: Readonly<Record<string, DualSyncDecisionEntry>>;
  readonly syncPaused: boolean;
  readonly pauseReason: string;
  readonly canSubmit: boolean;
  readonly showToast: (intent: DualSyncToastIntent) => void;
}) {
  const [pending, setPending] = useState<PendingExactPreview | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [result, setResult] = useState<GbpPublishResponseV1 | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  const activeDecisions = decisions ?? workspace.decisions;

  const createPreview = useCallback(
    async (stateData = workspace.stateQuery.data) => {
      const readiness = buildDualSyncPublishPreviewReadiness({
        stateData,
        decisions: activeDecisions,
        syncPaused,
        pauseReason,
        canSubmit,
      });
      if (readiness.kind === 'blocked') {
        if (readiness.message) showToast({ kind: 'error', message: readiness.message });
        return;
      }
      try {
        const preview = await workspace.exactPreviewPublishMutation.mutateAsync(readiness.request);
        setPending({ request: readiness.request, preview });
        setPreviewOpen(true);
      } catch (error) {
        showToast({
          kind: 'error',
          message: getDualSyncErrorMessage(error, 'Exact Google preview failed.'),
        });
      }
    },
    [activeDecisions, canSubmit, pauseReason, showToast, syncPaused, workspace],
  );

  const confirm = useCallback(
    async (confirmation: GbpExactPublishConfirmation) => {
      if (!pending) return;
      const decisions = pending.preview.groups.flatMap((group) =>
        group.fieldKeys.flatMap((fieldKey) => {
          const decision = pending.request.decisions.find(
            (candidate) => candidate.fieldKey === fieldKey,
          );
          return decision
            ? [
                {
                  ...decision,
                  pinnedCoreHash: group.beforeHashes.core[fieldKey] ?? null,
                  pinnedGbpHash: group.beforeHashes.google[fieldKey] ?? null,
                },
              ]
            : [];
        }),
      );
      if (decisions.length === 0) {
        showToast({ kind: 'error', message: 'The exact preview contains no publishable fields.' });
        return;
      }
      try {
        const next = await workspace.exactPublishMutation.mutateAsync({
          ...pending.request,
          decisions,
          pinnedCoreSnapshotHash: pending.preview.snapshotPins.core,
          pinnedGbpSnapshotHash: pending.preview.snapshotPins.google,
          confirmationVersion: 'gbp-exact-consent-v1',
          preview: pending.preview,
          acknowledged: true,
          riskAcknowledgements: confirmation.riskAcknowledgements,
          mode: confirmation.mode,
        });
        workspace.setDecisions({});
        setPending(null);
        setPreviewOpen(false);
        setResult(next);
        setResultOpen(true);
        if (next.mode === 'queued') {
          showToast({
            kind: 'info',
            message: 'Google publish queued. Follow the job to its terminal outcome.',
          });
        } else if (next.outcomes.some((outcome) => outcome.status === 'outcome_unknown')) {
          showToast({
            kind: 'warning',
            message:
              'Provider outcome unknown. Refresh Google, verify the listing, and create a new preview.',
          });
        } else if (next.outcomes.every((outcome) => outcome.status === 'consumed')) {
          showToast({ kind: 'success', message: 'Google publish completed.' });
        } else {
          showToast({
            kind: 'error',
            message: 'Google publish did not complete. Review each operation before retrying.',
          });
        }
      } catch (error) {
        showToast({
          kind: 'error',
          message: getDualSyncErrorMessage(error, 'Exact Google publish failed.'),
        });
      }
    },
    [pending, showToast, workspace],
  );

  const refreshExpired = useCallback(async () => {
    setPending(null);
    setPreviewOpen(false);
    try {
      await workspace.refreshMutation.mutateAsync();
      const refreshed = await workspace.stateQuery.refetch();
      await createPreview(refreshed.data);
    } catch (error) {
      showToast({
        kind: 'error',
        message: getDualSyncErrorMessage(error, 'Unable to refresh expired preview.'),
      });
    }
  }, [createPreview, showToast, workspace.refreshMutation, workspace.stateQuery]);

  return {
    onClickPublish: () => void createPreview(),
    onConfirm: (confirmation: GbpExactPublishConfirmation) => void confirm(confirmation),
    onRefreshExpired: () => void refreshExpired(),
    preview: pending?.preview ?? null,
    previewOpen,
    result,
    resultOpen,
    setPreviewOpen,
    setResultOpen,
  };
}
