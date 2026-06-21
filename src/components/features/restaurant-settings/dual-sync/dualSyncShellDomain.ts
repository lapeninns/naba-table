import { summarizeFieldsToHeatmap } from './heatmap';

import type { DualSyncHeatmapCounts } from './heatmap';
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

export interface DualSyncShellViewStateInput {
  readonly stateData: GetDualSyncStateResponse | null | undefined;
  readonly decisionCount: number;
  readonly publishPending: boolean;
  readonly previewPublishPending: boolean;
}

export interface DualSyncShellViewState {
  readonly syncPaused: boolean;
  readonly pauseReason: string;
  readonly autoExportable: number;
  readonly totalOpen: number;
  readonly lastSnapshotAt: string | null;
  readonly overallHeatmap: DualSyncHeatmapCounts;
  readonly writeBlocked: boolean;
  readonly canSubmit: boolean;
}

export function buildDualSyncShellViewState({
  stateData,
  decisionCount,
  publishPending,
  previewPublishPending,
}: DualSyncShellViewStateInput): DualSyncShellViewState {
  const outboundQueue = stateData?.outboundQueue ?? null;
  const control = stateData?.control ?? null;
  const syncPaused = control?.syncPaused ?? false;
  const pauseReason = control?.pauseReason ?? 'Dual-sync is paused for this restaurant.';
  const writeBlocked = syncPaused || publishPending || previewPublishPending;

  return {
    syncPaused,
    pauseReason,
    autoExportable: outboundQueue?.autoExportable ?? 0,
    totalOpen: outboundQueue?.totalOpen ?? 0,
    lastSnapshotAt: getDualSyncLastSnapshotAt(stateData?.lastSnapshot),
    overallHeatmap: summarizeFieldsToHeatmap(stateData?.fields ?? []),
    writeBlocked,
    canSubmit: decisionCount > 0 && !writeBlocked,
  };
}
