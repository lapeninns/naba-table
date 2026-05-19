'use client';

import { CalendarDays, Clock3, UtensilsCrossed, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

import { type DayErrors } from '../availabilityScheduleManagerUtils';
import { GbpDriftBadge } from '../gbpDriftBadges';
import { type DayServiceConfig } from '../servicePeriodsMapper';
import { DAYS_OF_WEEK, type WeeklyErrors, type WeeklyRow } from '../types';
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
  showWeeklyHours?: boolean;
  showServiceWindows?: boolean;
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
  showWeeklyHours = true,
  showServiceWindows = true,
}: AvailabilityScheduleDayCardProps) {
  const dayLabel = day?.label ?? DAYS_OF_WEEK[row.dayOfWeek] ?? 'Day';
  const isClosed = row.isClosed;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className={cn(
        'rounded-xl border transition-all duration-300 p-5 relative overflow-hidden',
        isClosed
          ? 'border-muted-foreground/10 bg-muted/[0.08] shadow-inner opacity-95'
          : 'border-primary/10 backdrop-blur-sm bg-card/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgba(99,102,241,0.03)] hover:border-primary/20',
      )}
    >
      {/* Decorative vertical HSL accent glow strip on the side */}
      <div
        className={cn(
          'absolute left-0 top-0 bottom-0 w-1 transition-all duration-300',
          isClosed
            ? 'bg-muted-foreground/20'
            : 'bg-gradient-to-b from-indigo-500 to-indigo-600 shadow-[2px_0_10px_rgba(99,102,241,0.3)]',
        )}
      />

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

        {/* Toggle switch for Open/Closed day */}
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
              onWeeklyChange(row.dayOfWeek, {
                isClosed: !checked,
                opensAt: checked ? row.opensAt : '',
                closesAt: checked ? row.closesAt : '',
              })
            }
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {isClosed ? (
          <motion.div
            key="closed"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-5 pl-2"
          >
            <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-500/20 bg-slate-500/[0.02] p-4 text-xs text-muted-foreground">
              <AlertTriangle className="size-4 shrink-0 text-slate-400" />
              <span>
                The kitchen is closed on this day. Enable &quot;Open Day&quot; to configure
                operating hours and meal windows.
              </span>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="open"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="mt-5 space-y-5 pl-2"
          >
            {showWeeklyHours && (
              <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
                {/* 1. Operating Hours Block */}
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
                        onChange={(event) =>
                          onWeeklyChange(row.dayOfWeek, { opensAt: event.target.value })
                        }
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
                        onChange={(event) =>
                          onWeeklyChange(row.dayOfWeek, { closesAt: event.target.value })
                        }
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

                {/* 2. Booking Rules Block */}
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
                        <p className="mt-1 text-xs text-destructive">
                          {rowErrors.reservationSlotTimes}
                        </p>
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
                      onChange={(event) =>
                        onWeeklyChange(row.dayOfWeek, { notes: event.target.value })
                      }
                      className="mt-1.5 h-9 bg-background/50 border-primary/15 focus:border-indigo-500 focus:ring-indigo-500/10"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 3. Service Windows Meal editors */}
            {showServiceWindows && (
              <div className="space-y-4 pt-4 border-t border-primary/5">
                <div className="flex items-center gap-2.5 text-xs font-bold uppercase tracking-wider text-foreground">
                  <div className="p-1 rounded bg-emerald-500/10 border border-emerald-500/10">
                    <UtensilsCrossed className="size-3.5 text-emerald-500" />
                  </div>
                  Service windows (Lunch / Dinner Sessions)
                </div>
                <div className="grid gap-4 xl:grid-cols-2">
                  <ScheduleMealWindowEditor
                    idPrefix={`day-${row.dayOfWeek}-lunch`}
                    label="Lunch"
                    meal={
                      day?.lunch ?? { enabled: false, endTime: '', name: 'Lunch', startTime: '' }
                    }
                    disabled={!day || day.isClosed || !hasRequiredOccasions}
                    errors={dayError?.lunch}
                    onToggle={(value) => onMealToggle(row.dayOfWeek, 'lunch', value)}
                    onChange={(field, value) =>
                      onMealTimeChange(row.dayOfWeek, 'lunch', field, value)
                    }
                  />
                  <ScheduleMealWindowEditor
                    idPrefix={`day-${row.dayOfWeek}-dinner`}
                    label="Dinner"
                    meal={
                      day?.dinner ?? { enabled: false, endTime: '', name: 'Dinner', startTime: '' }
                    }
                    disabled={!day || day.isClosed || !hasRequiredOccasions}
                    errors={dayError?.dinner}
                    onToggle={(value) => onMealToggle(row.dayOfWeek, 'dinner', value)}
                    onChange={(field, value) =>
                      onMealTimeChange(row.dayOfWeek, 'dinner', field, value)
                    }
                  />
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
