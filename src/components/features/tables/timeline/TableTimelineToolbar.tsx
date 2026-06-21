import { RotateCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

import { SERVICE_OPTIONS, STATUS_OPTIONS, type TimelineService } from './tableTimelineDomain';

import type { TableTimelineResponse, TableTimelineSegmentState } from '@/types/ops';

type TimelineZone = NonNullable<TableTimelineResponse['summary']>['zones'][number];

export function TableTimelineToolbar({
  dataUpdatedAt,
  isFetching,
  selectedZone,
  service,
  statusFilters,
  zones,
  onRefresh,
  onSelectZone,
  onServiceChange,
  onToggleStatusFilter,
}: {
  readonly dataUpdatedAt: number;
  readonly isFetching: boolean;
  readonly selectedZone: string | null;
  readonly service: TimelineService;
  readonly statusFilters: ReadonlyArray<TableTimelineSegmentState>;
  readonly zones: ReadonlyArray<TimelineZone>;
  readonly onRefresh: () => void;
  readonly onSelectZone: (zoneId: string | null) => void;
  readonly onServiceChange: (service: TimelineService) => void;
  readonly onToggleStatusFilter: (status: TableTimelineSegmentState) => void;
}) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-muted/20 p-4">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onSelectZone(null)}
            aria-pressed={!selectedZone}
            className={cn(
              'h-auto rounded-full px-4 py-1.5 text-xs font-semibold transition-colors',
              !selectedZone
                ? 'bg-foreground text-background'
                : 'bg-muted text-muted-foreground hover:bg-muted/70',
            )}
          >
            All Zones
          </Button>
          {zones.map((zone) => (
            <Button
              key={zone.id}
              type="button"
              variant="ghost"
              onClick={() => onSelectZone(zone.id)}
              aria-pressed={selectedZone === zone.id}
              className={cn(
                'h-auto rounded-full px-4 py-1.5 text-xs font-semibold transition-colors',
                selectedZone === zone.id
                  ? 'bg-foreground text-background'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70',
              )}
            >
              {zone.name || 'Unnamed zone'}
            </Button>
          ))}
        </div>

        <div className="hidden flex-wrap items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground md:flex">
          {STATUS_OPTIONS.filter((option) => option.value !== 'available').map((option) => (
            <div key={option.value} className="flex items-center gap-1.5">
              <span className={cn('size-2.5 rounded-full', option.dot)} />
              {option.label}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-b border-border/60 px-4 py-3 text-xs text-muted-foreground">
        <div className="min-w-[220px]">
          <Label htmlFor="timeline-service" className="sr-only">
            Service
          </Label>
          <Select
            value={service}
            onValueChange={(value) => onServiceChange(value as TimelineService)}
          >
            <SelectTrigger id="timeline-service" className="h-9">
              <SelectValue placeholder="All services" />
            </SelectTrigger>
            <SelectContent>
              {SERVICE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Status
          </span>
          {STATUS_OPTIONS.map((option) => {
            const active = statusFilters.includes(option.value);
            return (
              <Button
                key={option.value}
                type="button"
                variant="ghost"
                onClick={() => onToggleStatusFilter(option.value)}
                aria-pressed={active}
                className={cn(
                  'h-auto rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                  active
                    ? option.pill
                    : 'bg-muted text-foreground border border-border hover:border-primary/40',
                )}
              >
                <span
                  className={cn('size-2.5 rounded-full', option.dot, !active && 'opacity-60')}
                />
                {option.label}
              </Button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span>
            Last updated {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : '—'}
          </span>
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={isFetching}>
            <RotateCw data-icon="inline-start" className={cn(isFetching && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>
    </>
  );
}
