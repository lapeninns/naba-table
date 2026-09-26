import { pluralise } from '../shared/settingsSaveSequence';

import type { DualSyncDecisionSummary } from './dualSyncShellDomain';

export interface DualSyncReviewActionStateInput {
  readonly syncPaused: boolean;
  readonly pauseReason: string;
  readonly controlPending: boolean;
  readonly refreshPending: boolean;
  readonly autoExportPending: boolean;
  readonly publishPending: boolean;
  readonly previewPublishPending: boolean;
  readonly importPending: boolean;
  readonly canPublish: boolean;
  readonly canImport: boolean;
  readonly autoExportable: number;
  readonly summary: DualSyncDecisionSummary;
}

export interface DualSyncReviewActionModel {
  readonly label: string;
  readonly disabled: boolean;
  /** Shown as text beside the control when it is disabled (never a tooltip only). */
  readonly disabledHint: string | null;
}

export interface DualSyncReviewActionState {
  readonly refresh: DualSyncReviewActionModel;
  readonly publish: DualSyncReviewActionModel;
  readonly importValues: DualSyncReviewActionModel & { readonly visible: boolean };
  readonly control: DualSyncReviewActionModel;
  readonly autoExport: DualSyncReviewActionModel;
}

/** "2 to send · 1 to use from Google · 0 ignored" */
export function formatDualSyncDecisionSummary(summary: DualSyncDecisionSummary): string {
  return `${summary.toSend} to send · ${summary.toImport} to use from Google · ${summary.ignored} ignored`;
}

/** The sentence under the summary that says what each primary action will do. */
export function describeDualSyncDecisionOutcome(summary: DualSyncDecisionSummary): string {
  const parts: string[] = [];
  if (summary.toImport > 0) {
    parts.push(
      `${pluralise(summary.toImport, 'value')} from Google will be saved in Nabatable only.`,
    );
  }
  parts.push(
    summary.toSend > 0
      ? `${pluralise(summary.toSend, 'change')} will go to Google after you confirm the exact plan.`
      : 'Nothing to publish to Google yet.',
  );
  return parts.join(' ');
}

export function getDualSyncReviewActionState(
  input: DualSyncReviewActionStateInput,
): DualSyncReviewActionState {
  const busy = input.publishPending || input.previewPublishPending || input.importPending;
  const busyHint = 'Finish the running publish or preview first.';

  return {
    refresh: {
      label: input.refreshPending ? 'Getting latest…' : 'Get latest from Google',
      disabled: input.syncPaused || input.refreshPending,
      disabledHint: input.syncPaused ? input.pauseReason : null,
    },
    publish: {
      label: input.publishPending
        ? 'Publishing…'
        : input.summary.toSend > 0
          ? `Review and publish (${input.summary.toSend})`
          : 'Review and publish',
      disabled: !input.canPublish,
      disabledHint: input.canPublish
        ? null
        : input.syncPaused
          ? input.pauseReason
          : busy
            ? busyHint
            : 'Choose Send to Google on at least one field to publish.',
    },
    importValues: {
      visible: input.summary.toImport > 0,
      label: input.importPending
        ? 'Saving…'
        : `Use ${pluralise(input.summary.toImport, 'Google value')}`,
      disabled: !input.canImport,
      disabledHint: input.canImport ? null : input.syncPaused ? input.pauseReason : busyHint,
    },
    control: {
      label: input.controlPending ? 'Updating…' : input.syncPaused ? 'Resume sync' : 'Pause sync',
      disabled: input.controlPending,
      disabledHint: null,
    },
    autoExport: {
      label: input.autoExportPending
        ? 'Publishing queued changes…'
        : `Publish queued changes (${input.autoExportable})`,
      disabled: input.syncPaused || input.autoExportable === 0 || input.autoExportPending,
      disabledHint: input.syncPaused
        ? input.pauseReason
        : input.autoExportable === 0
          ? 'Nothing is queued to send to Google.'
          : null,
    },
  };
}
