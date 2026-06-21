import { CardHeader } from '@/components/ui/card';

import { DualSyncShellHeaderActions } from './DualSyncShellHeaderActions';
import { DualSyncShellHeaderProgress } from './DualSyncShellHeaderProgress';
import { DualSyncShellHeaderStatus } from './DualSyncShellHeaderStatus';

import type { DualSyncHeatmapCounts } from './heatmap';
import type { WorkspaceReviewProgress } from './workspace-progress';

export interface DualSyncShellHeaderProps {
  readonly totalOpen: number;
  readonly autoExportable: number;
  readonly lastSnapshotAt: string | null;
  readonly overallHeatmap: DualSyncHeatmapCounts;
  readonly syncPaused: boolean;
  readonly pauseReason: string;
  readonly showDriftOnly: boolean;
  readonly controlPending: boolean;
  readonly refreshPending: boolean;
  readonly autoExportPending: boolean;
  readonly publishPending: boolean;
  readonly previewPublishPending: boolean;
  readonly canSubmit: boolean;
  readonly decisionCount: number;
  readonly workspaceProgress: WorkspaceReviewProgress;
  readonly onToggleDriftOnly: () => void;
  readonly onToggleControl: () => void;
  readonly onRefresh: () => void;
  readonly onAutoExport: () => void;
  readonly onPublish: () => void;
}

export function DualSyncShellHeader({
  totalOpen,
  autoExportable,
  lastSnapshotAt,
  overallHeatmap,
  syncPaused,
  pauseReason,
  showDriftOnly,
  controlPending,
  refreshPending,
  autoExportPending,
  publishPending,
  previewPublishPending,
  canSubmit,
  decisionCount,
  workspaceProgress,
  onToggleDriftOnly,
  onToggleControl,
  onRefresh,
  onAutoExport,
  onPublish,
}: DualSyncShellHeaderProps) {
  return (
    <CardHeader className="flex flex-col gap-3 pb-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <DualSyncShellHeaderStatus
          totalOpen={totalOpen}
          lastSnapshotAt={lastSnapshotAt}
          overallHeatmap={overallHeatmap}
          syncPaused={syncPaused}
        />
        <DualSyncShellHeaderActions
          syncPaused={syncPaused}
          pauseReason={pauseReason}
          showDriftOnly={showDriftOnly}
          controlPending={controlPending}
          refreshPending={refreshPending}
          autoExportPending={autoExportPending}
          publishPending={publishPending}
          previewPublishPending={previewPublishPending}
          canSubmit={canSubmit}
          autoExportable={autoExportable}
          decisionCount={decisionCount}
          onToggleDriftOnly={onToggleDriftOnly}
          onToggleControl={onToggleControl}
          onRefresh={onRefresh}
          onAutoExport={onAutoExport}
          onPublish={onPublish}
        />
      </div>
      <DualSyncShellHeaderProgress workspaceProgress={workspaceProgress} />
    </CardHeader>
  );
}
