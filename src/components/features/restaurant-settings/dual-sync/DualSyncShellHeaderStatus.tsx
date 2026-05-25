import { Badge } from '@/components/ui/badge';
import { CardTitle } from '@/components/ui/card';

import { DualSyncFreshnessChip } from './DualSyncFreshnessChip';
import { DualSyncHeatmap } from './DualSyncHeatmap';

import type { DualSyncHeatmapCounts } from './heatmap';

export interface DualSyncShellHeaderStatusProps {
  readonly totalOpen: number;
  readonly lastSnapshotAt: string | null;
  readonly overallHeatmap: DualSyncHeatmapCounts;
  readonly syncPaused: boolean;
}

export function DualSyncShellHeaderStatus({
  totalOpen,
  lastSnapshotAt,
  overallHeatmap,
  syncPaused,
}: DualSyncShellHeaderStatusProps) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <CardTitle className="text-base">Google Business Profile sync</CardTitle>
      {totalOpen > 0 ? (
        <Badge variant="secondary" className="font-mono text-xs">
          {totalOpen} pending
        </Badge>
      ) : null}
      <DualSyncFreshnessChip
        timestamp={lastSnapshotAt}
        prefix="Verified"
        neverLabel="Never verified"
      />
      {overallHeatmap.total > 0 ? <DualSyncHeatmap counts={overallHeatmap} /> : null}
      {syncPaused ? (
        <Badge variant="destructive" className="text-xs">
          Paused
        </Badge>
      ) : null}
    </div>
  );
}
