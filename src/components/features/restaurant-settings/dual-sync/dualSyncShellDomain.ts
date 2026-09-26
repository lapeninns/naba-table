import type { DualSyncDecisionEntry } from './dualSyncWorkspaceDecisionDomain';
import type { DualSyncDecisionAction } from '@/server/dual-sync';
import type { GetDualSyncStateResponse } from '@/services/ops/dual-sync';

export function getDualSyncLastSnapshotAt(
  lastSnapshot:
    | {
        readonly finishedAt: string | null;
        readonly startedAt: string;
      }
    | null
    | undefined,
): string | null {
  return lastSnapshot?.finishedAt ?? lastSnapshot?.startedAt ?? null;
}

/** Counts behind "N to send · N to use from Google · N ignored". */
export interface DualSyncDecisionSummary {
  readonly toSend: number;
  readonly toImport: number;
  readonly ignored: number;
}

export function summarizeDualSyncDecisions(
  decisions: Readonly<Record<string, DualSyncDecisionEntry>>,
): DualSyncDecisionSummary {
  let toSend = 0;
  let toImport = 0;
  let ignored = 0;
  for (const entry of Object.values(decisions)) {
    if (entry.action === 'export_to_google') toSend += 1;
    else if (entry.action === 'import_from_google') toImport += 1;
    else ignored += 1;
  }
  return { toSend, toImport, ignored };
}

/**
 * The subset of draft decisions with one action. "Review and publish" sends only the Google
 * exports through the exact-consent path; "Use Google values" sends only the imports through the
 * Nabatable-only publish path (which the API refuses for exports).
 */
export function pickDualSyncDecisions(
  decisions: Readonly<Record<string, DualSyncDecisionEntry>>,
  action: DualSyncDecisionAction,
): Record<string, DualSyncDecisionEntry> {
  return Object.fromEntries(
    Object.entries(decisions).filter(([, entry]) => entry.action === action),
  );
}

export interface DualSyncShellViewStateInput {
  readonly stateData: GetDualSyncStateResponse | null | undefined;
  readonly decisions: Readonly<Record<string, DualSyncDecisionEntry>>;
  readonly publishPending: boolean;
  readonly previewPublishPending: boolean;
}

export interface DualSyncShellViewState {
  readonly syncPaused: boolean;
  readonly pauseReason: string;
  readonly autoExportable: number;
  readonly totalOpen: number;
  readonly lastSnapshotAt: string | null;
  readonly writeBlocked: boolean;
  readonly decisionSummary: DualSyncDecisionSummary;
  /** At least one field is set to "Send to Google" and nothing blocks writes. */
  readonly canPublish: boolean;
  /** At least one field is set to "Use Google's" and nothing blocks writes. */
  readonly canImport: boolean;
}

export function buildDualSyncShellViewState({
  stateData,
  decisions,
  publishPending,
  previewPublishPending,
}: DualSyncShellViewStateInput): DualSyncShellViewState {
  const outboundQueue = stateData?.outboundQueue ?? null;
  const control = stateData?.control ?? null;
  const syncPaused = control?.syncPaused ?? false;
  const pauseReason = control?.pauseReason ?? 'Dual-sync is paused for this restaurant.';
  const writeBlocked = syncPaused || publishPending || previewPublishPending;
  const decisionSummary = summarizeDualSyncDecisions(decisions);

  return {
    syncPaused,
    pauseReason,
    autoExportable: outboundQueue?.autoExportable ?? 0,
    totalOpen: outboundQueue?.totalOpen ?? 0,
    lastSnapshotAt: getDualSyncLastSnapshotAt(stateData?.lastSnapshot),
    writeBlocked,
    decisionSummary,
    canPublish: decisionSummary.toSend > 0 && !writeBlocked,
    canImport: decisionSummary.toImport > 0 && !writeBlocked,
  };
}
