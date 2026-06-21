'use client';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

import { StatTile } from './StatTile';
import { StatusDot } from './StatusDot';

import type { FloorPlanStats } from './useFloorPlanState';

export type FloorPlanCockpitProps = {
  venueName: string;
  kicker: string;
  summary: string;
  stats: FloorPlanStats;
  canEdit: boolean;
  editMode: boolean;
  onToggleEdit: () => void;
};

/** Brand/title header + cockpit stat tiles + live status + Edit-layout toggle (admin). */
export function FloorPlanCockpit({
  venueName,
  kicker,
  summary,
  stats,
  canEdit,
  editMode,
  onToggleEdit,
}: FloorPlanCockpitProps) {
  return (
    <header className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          {kicker}
        </div>
        <div className="flex items-center gap-4">
          {canEdit ? (
            <Label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <span className="font-mono uppercase tracking-wide">Edit layout</span>
              <Switch checked={editMode} onCheckedChange={onToggleEdit} aria-label="Edit layout" />
            </Label>
          ) : null}
          <StatusDot
            label={editMode ? 'Editing layout' : 'Service operational'}
            tone={editMode ? 'primary' : 'success'}
            pulse={!editMode}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-5 border-b border-border pb-4">
        <div>
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-foreground">
            {venueName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{summary}</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <StatTile
            value={stats.seatedCovers}
            suffix={`/${stats.capacity}`}
            label="Covers seated"
            detail={`${stats.occupancyPct}% of capacity`}
            tone="primary"
          />
          <StatTile
            value={stats.bookedCovers}
            label="Booked ahead"
            detail="covers held"
            tone="default"
          />
          <StatTile
            value={stats.openTables}
            label="Tables open"
            detail="ready to seat"
            tone="default"
          />
        </div>
      </div>
    </header>
  );
}
