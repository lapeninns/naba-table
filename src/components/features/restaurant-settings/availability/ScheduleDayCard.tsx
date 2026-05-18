'use client';

import { CalendarDays, Clock3, UtensilsCrossed } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

import { type DayErrors } from '../availabilityScheduleManagerUtils';
import { GbpDriftBadge } from '../gbpDriftBadges';
import { type DayServiceConfig } from '../servicePeriodsMapper';
import { type WeeklyErrors, type WeeklyRow } from '../types';
import { ScheduleMealWindowEditor } from './ScheduleMealWindowEditor';

import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';

type AvailabilityScheduleDayCardProps = {
  day: DayServiceConfig | undefined;
  dayError: DayErrors[number] | undefined;
  hasRequiredOccasions: boolean;
  onMealTimeChange: (
    dayIndex: number,
    mealKey: 'lunch' | 'dinner',
    field: 'startTime' | 'endTime',
    value: string,
  ) => void;
  onMealToggle: (dayIndex: number, mealKey: 'lunch' | 'dinner', value: boolean) => void;
  onWeeklyChange: (index: number, patch: Partial<WeeklyRow>) => void;
  row: WeeklyRow;
  rowErrors: WeeklyErrors[number] | undefined;
  weeklyDriftField?: DualSyncFieldSummary | null;
  serviceDriftFields?: ReadonlyArray<DualSyncFieldSummary>;
};

export function AvailabilityScheduleDayCard({
  day,
  dayError,
  hasRequiredOccasions,
  onMealTimeChange,
  onMealToggle,
  onWeeklyChange,
  row,
  rowErrors,
  weeklyDriftField = null,
  serviceDriftFields = [],
}: AvailabilityScheduleDayCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border/70 bg-card/30 p-4 shadow-sm',
        row.isClosed && 'bg-muted/20',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <p className="text-base font-semibold text-foreground">{day?.label ?? 'Day'}</p>
            <Badge variant={row.isClosed ? 'secondary' : 'outline'}>
              {row.isClosed ? 'Closed' : 'Open'}
            </Badge>
            <GbpDriftBadge fields={[weeklyDriftField, ...serviceDriftFields]} />
          </div>
          <p className="text-sm text-muted-foreground">
            Set the day boundary first, then the service windows inside it.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label
            htmlFor={`day-${row.dayOfWeek}-open`}
            className="text-xs uppercase tracking-[0.18em] text-muted-foreground"
          >
            Open day
          </Label>
          <Switch
            id={`day-${row.dayOfWeek}-open`}
            checked={!row.isClosed}
            onCheckedChange={(checked) =>
              onWeeklyChange(row.dayOfWeek, {
                isClosed: !checked,
                opensAt: checked ? row.opensAt : '',
                closesAt: checked ? row.closesAt : '',
              })
            }
          />
        </div>
      </div>

      {row.isClosed ? (
        <div className="mt-4 rounded-lg border border-dashed border-border/70 bg-background/70 px-4 py-3 text-sm text-muted-foreground">
          The restaurant is closed on this day. Reopen it to set operating hours and service
          windows.
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)]">
            <div className="rounded-lg border border-border/60 bg-background/80 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Clock3 className="size-4 text-muted-foreground" />
                Operating hours
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div>
                  <Label
                    htmlFor={`day-${row.dayOfWeek}-opens-at`}
                    className="text-xs uppercase tracking-[0.18em] text-muted-foreground"
                  >
                    Opens
                  </Label>
                  <Input
                    id={`day-${row.dayOfWeek}-opens-at`}
                    name={`day-${row.dayOfWeek}-opens-at`}
                    type="time"
                    value={row.opensAt}
                    onChange={(event) =>
                      onWeeklyChange(row.dayOfWeek, { opensAt: event.target.value })
                    }
                    aria-invalid={Boolean(rowErrors?.opensAt)}
                    className={cn('mt-1', rowErrors?.opensAt && 'border-destructive')}
                  />
                  {rowErrors?.opensAt ? (
                    <p className="mt-1 text-xs text-destructive">{rowErrors.opensAt}</p>
                  ) : null}
                </div>
                <div>
                  <Label
                    htmlFor={`day-${row.dayOfWeek}-closes-at`}
                    className="text-xs uppercase tracking-[0.18em] text-muted-foreground"
                  >
                    Closes
                  </Label>
                  <Input
                    id={`day-${row.dayOfWeek}-closes-at`}
                    name={`day-${row.dayOfWeek}-closes-at`}
                    type="time"
                    value={row.closesAt}
                    onChange={(event) =>
                      onWeeklyChange(row.dayOfWeek, { closesAt: event.target.value })
                    }
                    aria-invalid={Boolean(rowErrors?.closesAt)}
                    className={cn('mt-1', rowErrors?.closesAt && 'border-destructive')}
                  />
                  {rowErrors?.closesAt ? (
                    <p className="mt-1 text-xs text-destructive">{rowErrors.closesAt}</p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border/60 bg-background/80 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <CalendarDays className="size-4 text-muted-foreground" />
                Booking rules
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-[140px_minmax(0,1fr)]">
                <div>
                  <Label
                    htmlFor={`day-${row.dayOfWeek}-interval`}
                    className="text-xs uppercase tracking-[0.18em] text-muted-foreground"
                  >
                    Interval (min)
                  </Label>
                  <Input
                    id={`day-${row.dayOfWeek}-interval`}
                    name={`day-${row.dayOfWeek}-interval`}
                    type="number"
                    min={1}
                    max={180}
                    value={row.reservationIntervalMinutes}
                    onChange={(event) =>
                      onWeeklyChange(row.dayOfWeek, {
                        reservationIntervalMinutes: event.target.value,
                      })
                    }
                    aria-invalid={Boolean(rowErrors?.reservationIntervalMinutes)}
                    className={cn(
                      'mt-1',
                      rowErrors?.reservationIntervalMinutes && 'border-destructive',
                    )}
                  />
                  {rowErrors?.reservationIntervalMinutes ? (
                    <p className="mt-1 text-xs text-destructive">
                      {rowErrors.reservationIntervalMinutes}
                    </p>
                  ) : null}
                </div>
                <div>
                  <Label
                    htmlFor={`day-${row.dayOfWeek}-slot-times`}
                    className="text-xs uppercase tracking-[0.18em] text-muted-foreground"
                  >
                    Slot times
                  </Label>
                  <Input
                    id={`day-${row.dayOfWeek}-slot-times`}
                    name={`day-${row.dayOfWeek}-slot-times`}
                    value={row.reservationSlotTimes}
                    placeholder="11:00, 11:30, 12:00"
                    onChange={(event) =>
                      onWeeklyChange(row.dayOfWeek, {
                        reservationSlotTimes: event.target.value,
                      })
                    }
                    aria-invalid={Boolean(rowErrors?.reservationSlotTimes)}
                    className={cn('mt-1', rowErrors?.reservationSlotTimes && 'border-destructive')}
                  />
                  {rowErrors?.reservationSlotTimes ? (
                    <p className="mt-1 text-xs text-destructive">
                      {rowErrors.reservationSlotTimes}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Optional comma-separated fixed slots.
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-3">
                <Label
                  htmlFor={`day-${row.dayOfWeek}-notes`}
                  className="text-xs uppercase tracking-[0.18em] text-muted-foreground"
                >
                  Notes
                </Label>
                <Input
                  id={`day-${row.dayOfWeek}-notes`}
                  name={`day-${row.dayOfWeek}-notes`}
                  value={row.notes}
                  placeholder="Optional notes for this day"
                  onChange={(event) => onWeeklyChange(row.dayOfWeek, { notes: event.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3 border-l-2 border-border/70 pl-4">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <UtensilsCrossed className="size-4 text-muted-foreground" />
              Service windows
            </div>
            <div className="grid gap-3 xl:grid-cols-2">
              <ScheduleMealWindowEditor
                idPrefix={`day-${row.dayOfWeek}-lunch`}
                label="Lunch"
                meal={day?.lunch ?? { enabled: false, endTime: '', name: 'Lunch', startTime: '' }}
                disabled={!day || day.isClosed || !hasRequiredOccasions}
                errors={dayError?.lunch}
                onToggle={(value) => onMealToggle(row.dayOfWeek, 'lunch', value)}
                onChange={(field, value) => onMealTimeChange(row.dayOfWeek, 'lunch', field, value)}
              />
              <ScheduleMealWindowEditor
                idPrefix={`day-${row.dayOfWeek}-dinner`}
                label="Dinner"
                meal={day?.dinner ?? { enabled: false, endTime: '', name: 'Dinner', startTime: '' }}
                disabled={!day || day.isClosed || !hasRequiredOccasions}
                errors={dayError?.dinner}
                onToggle={(value) => onMealToggle(row.dayOfWeek, 'dinner', value)}
                onChange={(field, value) => onMealTimeChange(row.dayOfWeek, 'dinner', field, value)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
