import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

import { GbpDriftBadge } from '../gbpDriftBadges';
import { buildScheduleDayOpenPatch } from './scheduleDayCardDomain';

import type { WeeklyRow } from '../types';
import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';

type ScheduleDayCardHeaderProps = {
  dayLabel: string;
  isClosed: boolean;
  onWeeklyChange: (index: number, patch: Partial<WeeklyRow>) => void;
  row: WeeklyRow;
  serviceDriftFields: ReadonlyArray<DualSyncFieldSummary>;
  weeklyDriftField: DualSyncFieldSummary | null;
};

export function ScheduleDayCardHeader({
  dayLabel,
  isClosed,
  onWeeklyChange,
  row,
  serviceDriftFields,
  weeklyDriftField,
}: ScheduleDayCardHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 pl-2">
      <div className="space-y-1">
        <div className="flex items-center gap-2.5">
          <p className="text-base font-bold tracking-tight text-foreground">{dayLabel}</p>
          <Badge
            variant={isClosed ? 'secondary' : 'outline'}
            className={cn(
              'transition-all duration-200 uppercase tracking-wider text-[10px] font-semibold px-2 py-0.5',
              isClosed
                ? 'bg-slate-500/10 border-slate-500/20 text-slate-500'
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 font-bold',
            )}
          >
            {isClosed ? 'Closed' : 'Open'}
          </Badge>
          <GbpDriftBadge fields={[weeklyDriftField, ...serviceDriftFields]} />
        </div>
        <p className="text-xs text-muted-foreground max-w-lg">
          Configure day boundary operating constraints, slot rules, and meal periods.
        </p>
      </div>

      <div className="flex items-center gap-3 bg-background/40 border border-primary/5 rounded-xl px-3.5 py-1.5 backdrop-blur-sm">
        <Label
          htmlFor={`day-${row.dayOfWeek}-open`}
          className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground cursor-pointer"
        >
          Open day
        </Label>
        <Switch
          id={`day-${row.dayOfWeek}-open`}
          checked={!isClosed}
          onCheckedChange={(checked) =>
            onWeeklyChange(row.dayOfWeek, buildScheduleDayOpenPatch(row, checked))
          }
        />
      </div>
    </div>
  );
}
