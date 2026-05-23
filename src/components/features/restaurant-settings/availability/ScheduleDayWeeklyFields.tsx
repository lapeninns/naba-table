import { CalendarDays, Clock3 } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

import type { WeeklyErrors, WeeklyRow } from '../types';

type ScheduleDayWeeklyFieldsProps = {
  onWeeklyChange: (index: number, patch: Partial<WeeklyRow>) => void;
  row: WeeklyRow;
  rowErrors: WeeklyErrors[number] | undefined;
};

export function ScheduleDayWeeklyFields({
  onWeeklyChange,
  row,
  rowErrors,
}: ScheduleDayWeeklyFieldsProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
      <div className="rounded-xl border border-primary/5 bg-background/30 p-4 shadow-sm backdrop-blur-[2px]">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-foreground pb-3 border-b border-primary/5">
          <div className="p-1 rounded bg-indigo-500/10 border border-indigo-500/10">
            <Clock3 className="size-3.5 text-indigo-500" />
          </div>
          Operating hours
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <div>
            <Label
              htmlFor={`day-${row.dayOfWeek}-opens-at`}
              className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground"
            >
              Opens
            </Label>
            <Input
              id={`day-${row.dayOfWeek}-opens-at`}
              name={`day-${row.dayOfWeek}-opens-at`}
              type="time"
              value={row.opensAt}
              onChange={(event) => onWeeklyChange(row.dayOfWeek, { opensAt: event.target.value })}
              aria-invalid={Boolean(rowErrors?.opensAt)}
              className={cn(
                'mt-1.5 h-9 bg-background/50 border-primary/15 focus:border-indigo-500 focus:ring-indigo-500/10',
                rowErrors?.opensAt && 'border-destructive',
              )}
            />
            {rowErrors?.opensAt ? (
              <p className="mt-1 text-xs text-destructive">{rowErrors.opensAt}</p>
            ) : null}
          </div>
          <div>
            <Label
              htmlFor={`day-${row.dayOfWeek}-closes-at`}
              className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground"
            >
              Closes
            </Label>
            <Input
              id={`day-${row.dayOfWeek}-closes-at`}
              name={`day-${row.dayOfWeek}-closes-at`}
              type="time"
              value={row.closesAt}
              onChange={(event) => onWeeklyChange(row.dayOfWeek, { closesAt: event.target.value })}
              aria-invalid={Boolean(rowErrors?.closesAt)}
              className={cn(
                'mt-1.5 h-9 bg-background/50 border-primary/15 focus:border-indigo-500 focus:ring-indigo-500/10',
                rowErrors?.closesAt && 'border-destructive',
              )}
            />
            {rowErrors?.closesAt ? (
              <p className="mt-1 text-xs text-destructive">{rowErrors.closesAt}</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-primary/5 bg-background/30 p-4 shadow-sm backdrop-blur-[2px]">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-foreground pb-3 border-b border-primary/5">
          <div className="p-1 rounded bg-amber-500/10 border border-amber-500/10">
            <CalendarDays className="size-3.5 text-amber-500" />
          </div>
          Booking rules
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[160px_minmax(0,1fr)]">
          <div>
            <Label
              htmlFor={`day-${row.dayOfWeek}-interval`}
              className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground"
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
                'mt-1.5 h-9 bg-background/50 border-primary/15 focus:border-amber-500 focus:ring-amber-500/10',
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
              className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground"
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
              className={cn(
                'mt-1.5 h-9 bg-background/50 border-primary/15 focus:border-amber-500 focus:ring-amber-500/10',
                rowErrors?.reservationSlotTimes && 'border-destructive',
              )}
            />
            {rowErrors?.reservationSlotTimes ? (
              <p className="mt-1 text-xs text-destructive">{rowErrors.reservationSlotTimes}</p>
            ) : (
              <p className="mt-1 text-[10px] text-muted-foreground leading-normal">
                Optional comma-separated fixed slots (e.g. 11:00, 11:30).
              </p>
            )}
          </div>
        </div>
        <div className="mt-4">
          <Label
            htmlFor={`day-${row.dayOfWeek}-notes`}
            className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground"
          >
            Notes
          </Label>
          <Input
            id={`day-${row.dayOfWeek}-notes`}
            name={`day-${row.dayOfWeek}-notes`}
            value={row.notes}
            placeholder="Add custom notes or closure context for this day"
            onChange={(event) => onWeeklyChange(row.dayOfWeek, { notes: event.target.value })}
            className="mt-1.5 h-9 bg-background/50 border-primary/15 focus:border-indigo-500 focus:ring-indigo-500/10"
          />
        </div>
      </div>
    </div>
  );
}
