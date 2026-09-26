'use client';

import { AlertTriangle, ChevronRight, Copy, Undo2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

import { toComparableTime } from '../availabilityScheduleTime';
import { pluralise } from '../shared/settingsSaveSequence';
import { DAYS_OF_WEEK, type WeeklyRow } from '../types';
import { AvailabilityTimeField, FieldErrorText, TOUCH_TARGET_CLASS } from './AvailabilityFields';
import { MEAL_KEYS, MEAL_LABEL, WEEK_ORDER, type MealKey } from './availabilityPageDraft';
import {
  availabilityFieldId,
  TYPES_REQUIRED_KEY,
  weekdayFieldKey,
  type AvailabilityErrors,
} from './availabilityPageValidation';

import type { DayServiceConfig } from '../servicePeriodsMapper';

export const WEEKLY_HOURS_SECTION_ID = 'weekly-hours';

const SCALE_START = 10 * 60;
const SCALE_END = 24 * 60;
const SCALE_TICKS = [10, 12, 14, 16, 18, 20, 22, 24];

const pct = (minutes: number) =>
  Math.max(0, Math.min(100, ((minutes - SCALE_START) / (SCALE_END - SCALE_START)) * 100));

const toMinutes = (value: string | null | undefined): number | null => {
  const comparable = toComparableTime(value ?? null);
  if (!comparable) return null;
  const [hours, minutes] = comparable.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
};

const formatMinutes = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

export type WeekdayView = {
  row: WeeklyRow;
  day: DayServiceConfig;
  edited: boolean;
  issueCount: number;
  googleDiffers: boolean;
};

/** Screen-reader and visible summary: the timeline itself is decorative. */
export function describeWeekday(
  view: Pick<WeekdayView, 'row' | 'day'>,
  options: { hasType: (meal: MealKey) => boolean; lastSeatingBuffer: number | null },
): string {
  const { row, day } = view;
  if (row.isClosed) {
    return row.notes ? `Closed · ${row.notes}` : 'Closed all day';
  }
  const parts = [`Open ${row.opensAt || '—'}–${row.closesAt || '—'}`];
  for (const meal of MEAL_KEYS) {
    const on = day[meal].enabled && options.hasType(meal);
    parts.push(`${MEAL_LABEL[meal]} ${on ? `${day[meal].startTime}–${day[meal].endTime}` : 'off'}`);
  }
  const close = toMinutes(row.closesAt);
  if (close !== null && options.lastSeatingBuffer !== null) {
    parts.push(`Last seating ${formatMinutes(Math.max(0, close - options.lastSeatingBuffer))}`);
  }
  if (row.reservationSlotTimes.trim()) {
    parts.push('Fixed start times');
  } else if (row.reservationIntervalMinutes.trim()) {
    parts.push(`Every ${row.reservationIntervalMinutes.trim()} min`);
  }
  return parts.join(' · ');
}

function WeekdayTimeline({
  row,
  day,
  hasType,
  lastSeatingBuffer,
}: {
  row: WeeklyRow;
  day: DayServiceConfig;
  hasType: (meal: MealKey) => boolean;
  lastSeatingBuffer: number | null;
}) {
  if (row.isClosed) {
    return (
      <span className="flex h-7 items-center rounded-md border border-dashed border-border px-2.5 text-xs text-muted-foreground">
        Closed
      </span>
    );
  }
  const open = toMinutes(row.opensAt);
  const close = toMinutes(row.closesAt);
  const cut = close !== null && lastSeatingBuffer !== null ? close - lastSeatingBuffer : null;
  return (
    <span className="relative block h-7 @container" aria-hidden>
      <span className="absolute inset-x-0 top-1/2 h-px bg-border" />
      {open !== null && close !== null && close > open ? (
        <span
          className="absolute inset-y-0 rounded-md border border-border bg-muted"
          style={{ left: `${pct(open)}%`, width: `${pct(close) - pct(open)}%` }}
        />
      ) : null}
      {MEAL_KEYS.map((meal) => {
        const start = toMinutes(day[meal].startTime);
        const end = toMinutes(day[meal].endTime);
        if (
          !day[meal].enabled ||
          !hasType(meal) ||
          start === null ||
          end === null ||
          end <= start
        ) {
          return null;
        }
        return (
          <span
            key={meal}
            className={cn(
              'absolute inset-y-1 overflow-hidden whitespace-nowrap rounded px-1.5 text-[11px] font-semibold leading-5',
              meal === 'lunch' ? 'bg-chart-1 text-overlay' : 'bg-chart-5 text-primary-foreground',
            )}
            style={{ left: `${pct(start)}%`, width: `${pct(end) - pct(start)}%` }}
          >
            <span className="hidden @md:inline">{end - start >= 110 ? MEAL_LABEL[meal] : ''}</span>
          </span>
        );
      })}
      {cut !== null ? (
        <span
          className="absolute -inset-y-1 w-[3px] -translate-x-1/2 bg-[repeating-linear-gradient(180deg,var(--color-foreground)_0_3px,var(--color-background)_3px_5px)] ring-1 ring-background"
          style={{ left: `${pct(cut)}%` }}
        />
      ) : null}
    </span>
  );
}

type WeeklyHoursSectionProps = {
  weekdays: WeekdayView[];
  openDays: ReadonlySet<number>;
  errors: AvailabilityErrors;
  hasType: (meal: MealKey) => boolean;
  restaurantIntervalMinutes: string;
  lastSeatingBuffer: number | null;
  onToggleDay: (dayOfWeek: number) => void;
  onWeekdayChange: (
    dayOfWeek: number,
    patch: Partial<
      Pick<
        WeeklyRow,
        | 'opensAt'
        | 'closesAt'
        | 'isClosed'
        | 'notes'
        | 'reservationIntervalMinutes'
        | 'reservationSlotTimes'
      >
    >,
  ) => void;
  onMealChange: (
    dayOfWeek: number,
    meal: MealKey,
    patch: Partial<{ enabled: boolean; startTime: string; endTime: string }>,
  ) => void;
  onTouch: (key: string) => void;
  onCopyDay: (dayOfWeek: number) => void;
  onUndoDay: (dayOfWeek: number) => void;
};

export function WeeklyHoursSection(props: WeeklyHoursSectionProps) {
  const { weekdays, openDays, onToggleDay } = props;
  const editedDays = weekdays.filter((view) => view.edited).length;
  return (
    <Card
      id={WEEKLY_HOURS_SECTION_ID}
      aria-labelledby="availability-weekly-heading"
      className="scroll-mt-4 overflow-hidden border-border/70 shadow-none"
    >
      <CardHeader className="flex flex-row items-start justify-between gap-3 border-b border-border/60 px-4 py-4 sm:px-5">
        <div className="flex min-w-0 flex-col gap-1">
          <CardTitle
            id="availability-weekly-heading"
            role="heading"
            aria-level={2}
            className="text-base leading-6"
          >
            Weekly hours and meal times
          </CardTitle>
          <CardDescription>
            Your regular week. Select a day to change its hours or meal times.
          </CardDescription>
        </div>
        {editedDays > 0 ? (
          <Badge variant="status-pending">{pluralise(editedDays, 'day')} edited</Badge>
        ) : null}
      </CardHeader>
      <div
        className="flex flex-wrap gap-x-4 gap-y-1.5 border-b border-border/60 px-4 py-2.5 text-xs text-muted-foreground sm:px-5"
        aria-label="Timeline key"
      >
        <span className="inline-flex items-center gap-1.5">
          <i
            className="inline-block h-2.5 w-4 rounded-sm border border-border bg-muted"
            aria-hidden
          />
          Open
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block h-2.5 w-4 rounded-sm bg-chart-1" aria-hidden />
          Lunch
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block h-2.5 w-4 rounded-sm bg-chart-5" aria-hidden />
          Dinner
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i
            className="inline-block h-3.5 w-[3px] bg-[repeating-linear-gradient(180deg,var(--color-foreground)_0_3px,var(--color-background)_3px_5px)]"
            aria-hidden
          />
          Last seating
        </span>
      </div>
      <div
        className="hidden grid-cols-[8.25rem_minmax(0,1fr)_1rem] gap-3 px-4 pt-2 sm:px-5 md:grid"
        aria-hidden
      >
        <span />
        <span className="relative h-4 font-mono text-[11px] text-muted-foreground">
          {SCALE_TICKS.map((hour, index) => (
            <span
              key={hour}
              className={cn(
                'absolute whitespace-nowrap',
                index === 0
                  ? ''
                  : index === SCALE_TICKS.length - 1
                    ? '-translate-x-full'
                    : '-translate-x-1/2',
              )}
              style={{ left: `${((hour * 60 - SCALE_START) / (SCALE_END - SCALE_START)) * 100}%` }}
            >
              {String(hour % 24).padStart(2, '0')}:00
            </span>
          ))}
        </span>
        <span />
      </div>
      <ul className="divide-y divide-border/60">
        {WEEK_ORDER.map((dayOfWeek) => {
          const view = weekdays.find((item) => item.row.dayOfWeek === dayOfWeek);
          if (!view) return null;
          const expanded = openDays.has(dayOfWeek);
          const panelId = `availability-day-${dayOfWeek}-panel`;
          const dayName = DAYS_OF_WEEK[dayOfWeek];
          return (
            <li key={dayOfWeek} id={`availability-day-${dayOfWeek}`}>
              <Button
                type="button"
                variant="ghost"
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => onToggleDay(dayOfWeek)}
                className="grid h-auto w-full grid-cols-[minmax(0,1fr)_auto] items-center justify-stretch gap-x-3 gap-y-2 whitespace-normal rounded-none px-4 py-3 text-left font-normal tracking-normal hover:bg-muted/50 focus-visible:ring-inset active:translate-y-0 active:scale-100 motion-reduce:transition-none sm:px-5 md:grid-cols-[8.25rem_minmax(0,1fr)_1rem]"
              >
                <span className="flex min-w-0 flex-wrap items-center gap-1.5 font-semibold text-foreground">
                  <span>{dayName}</span>
                  {view.issueCount > 0 ? (
                    <Badge variant="status-cancelled" className="gap-1">
                      <AlertTriangle className="size-3" aria-hidden />
                      {pluralise(view.issueCount, 'issue')}
                    </Badge>
                  ) : null}
                  {view.edited ? <Badge variant="status-pending">Edited</Badge> : null}
                  {view.googleDiffers ? <Badge variant="outline">Google differs</Badge> : null}
                </span>
                <span className="col-start-2 row-start-1 text-muted-foreground md:col-start-3">
                  <ChevronRight
                    className={cn(
                      'size-4 transition-transform motion-reduce:transition-none',
                      expanded && 'rotate-90',
                    )}
                    aria-hidden
                  />
                </span>
                <span className="col-span-full flex min-w-0 flex-col gap-1.5 md:col-span-1 md:col-start-2 md:row-start-1">
                  <WeekdayTimeline
                    row={view.row}
                    day={view.day}
                    hasType={props.hasType}
                    lastSeatingBuffer={props.lastSeatingBuffer}
                  />
                  <span className="text-xs text-muted-foreground tabular-nums [text-wrap:pretty]">
                    {describeWeekday(view, {
                      hasType: props.hasType,
                      lastSeatingBuffer: props.lastSeatingBuffer,
                    })}
                  </span>
                </span>
              </Button>
              <div
                id={panelId}
                hidden={!expanded}
                className="px-4 pb-4 pt-1 sm:px-5 md:pl-[10.5rem]"
              >
                {expanded ? <WeekdayPanel {...props} view={view} /> : null}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function WeekdayPanel({
  view,
  errors,
  hasType,
  restaurantIntervalMinutes,
  onWeekdayChange,
  onMealChange,
  onTouch,
  onCopyDay,
  onUndoDay,
}: WeeklyHoursSectionProps & { view: WeekdayView }) {
  const { row, day } = view;
  const dayOfWeek = row.dayOfWeek;
  const dayName = DAYS_OF_WEEK[dayOfWeek];
  const key = (field: string) => weekdayFieldKey(dayOfWeek, field);
  const openSwitchId = availabilityFieldId(key('open'));
  const touch = (field: string) => () => onTouch(key(field));
  const moreOpen = Boolean(
    row.reservationIntervalMinutes.trim() || row.reservationSlotTimes.trim(),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Switch
          id={openSwitchId}
          checked={!row.isClosed}
          onCheckedChange={(checked) => {
            onWeekdayChange(dayOfWeek, { isClosed: !checked });
            onTouch(key('open'));
          }}
        />
        <Label htmlFor={openSwitchId}>Open on {dayName}s</Label>
        <span className="text-xs text-muted-foreground">{row.isClosed ? 'Closed' : 'Open'}</span>
      </div>

      {row.isClosed ? (
        <p className="rounded-md bg-muted/60 px-3 py-2.5 text-sm">
          <span className="font-medium">Closed every {dayName}.</span>{' '}
          <span className="text-muted-foreground">
            Guests can’t request times. To open on one {dayName}, add a special date.
          </span>
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <AvailabilityTimeField
              errorKey={key('opens')}
              label="Opens"
              value={row.opensAt}
              error={errors[key('opens')]}
              onChange={(value) => onWeekdayChange(dayOfWeek, { opensAt: value })}
              onBlur={touch('opens')}
            />
            <AvailabilityTimeField
              errorKey={key('closes')}
              label="Closes"
              value={row.closesAt}
              error={errors[key('closes')]}
              onChange={(value) => onWeekdayChange(dayOfWeek, { closesAt: value })}
              onBlur={touch('closes')}
            />
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-foreground">
              Meal times{' '}
              <span className="font-normal text-muted-foreground">
                — guests can only request times inside these
              </span>
            </p>
            <FieldErrorText
              id={`${availabilityFieldId(key('meals'))}-error`}
              message={errors[TYPES_REQUIRED_KEY]}
            />
            <div className="grid gap-3 lg:grid-cols-2">
              {MEAL_KEYS.map((meal) => {
                const typeExists = hasType(meal);
                const switchId = availabilityFieldId(key(`${meal}-on`));
                const on = day[meal].enabled;
                return (
                  <fieldset
                    key={meal}
                    className="flex flex-col gap-2 rounded-md border border-border/70 p-3"
                  >
                    <legend className="sr-only">{MEAL_LABEL[meal]}</legend>
                    <div className="flex items-center gap-3">
                      <Switch
                        id={switchId}
                        checked={on}
                        disabled={!typeExists}
                        onCheckedChange={(checked) => {
                          onMealChange(dayOfWeek, meal, { enabled: checked });
                          onTouch(key(`${meal}-start`));
                        }}
                      />
                      <Label htmlFor={switchId}>{MEAL_LABEL[meal]}</Label>
                      <span className="text-xs text-muted-foreground">
                        {!typeExists ? 'Needs booking type' : on ? 'On' : 'Off — no times offered'}
                      </span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <AvailabilityTimeField
                        errorKey={key(`${meal}-start`)}
                        label="First booking from"
                        value={day[meal].startTime}
                        disabled={!on || !typeExists}
                        error={errors[key(`${meal}-start`)]}
                        onChange={(value) => onMealChange(dayOfWeek, meal, { startTime: value })}
                        onBlur={touch(`${meal}-start`)}
                      />
                      <AvailabilityTimeField
                        errorKey={key(`${meal}-end`)}
                        label="Meal time ends"
                        value={day[meal].endTime}
                        disabled={!on || !typeExists}
                        error={errors[key(`${meal}-end`)]}
                        onChange={(value) => onMealChange(dayOfWeek, meal, { endTime: value })}
                        onBlur={touch(`${meal}-end`)}
                      />
                    </div>
                  </fieldset>
                );
              })}
            </div>
          </div>

          <details
            className="group rounded-md"
            open={moreOpen || undefined}
            id={availabilityFieldId(key('more'))}
          >
            <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-md py-1 text-sm font-medium text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 [&::-webkit-details-marker]:hidden">
              <ChevronRight
                className="size-4 transition-transform group-open:rotate-90 motion-reduce:transition-none"
                aria-hidden
              />
              More options for {dayName}s
            </summary>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={availabilityFieldId(key('interval'))}>
                  Time between booking slots
                </Label>
                <Input
                  id={availabilityFieldId(key('interval'))}
                  inputMode="numeric"
                  value={row.reservationIntervalMinutes}
                  placeholder={`Restaurant setting (${restaurantIntervalMinutes || '—'} min)`}
                  onChange={(event) =>
                    onWeekdayChange(dayOfWeek, { reservationIntervalMinutes: event.target.value })
                  }
                  onBlur={touch('interval')}
                  aria-invalid={Boolean(errors[key('interval')]) || undefined}
                  aria-describedby={`${availabilityFieldId(key('interval'))}-hint ${availabilityFieldId(key('interval'))}-error`}
                  className={TOUCH_TARGET_CLASS}
                />
                <p
                  id={`${availabilityFieldId(key('interval'))}-hint`}
                  className="text-xs text-muted-foreground"
                >
                  Minutes. Leave blank to use the restaurant setting.
                </p>
                <FieldErrorText
                  id={`${availabilityFieldId(key('interval'))}-error`}
                  message={errors[key('interval')]}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={availabilityFieldId(key('slots'))}>Fixed start times</Label>
                <Input
                  id={availabilityFieldId(key('slots'))}
                  value={row.reservationSlotTimes}
                  placeholder="e.g. 12:00, 12:30, 13:00"
                  onChange={(event) =>
                    onWeekdayChange(dayOfWeek, { reservationSlotTimes: event.target.value })
                  }
                  onBlur={touch('slots')}
                  aria-invalid={Boolean(errors[key('slots')]) || undefined}
                  aria-describedby={`${availabilityFieldId(key('slots'))}-hint ${availabilityFieldId(key('slots'))}-error`}
                  className={cn('font-mono', TOUCH_TARGET_CLASS)}
                />
                <p
                  id={`${availabilityFieldId(key('slots'))}-hint`}
                  className="text-xs text-muted-foreground"
                >
                  Replaces the regular spacing on {dayName}s. Only times inside lunch or dinner are
                  offered.
                </p>
                <FieldErrorText
                  id={`${availabilityFieldId(key('slots'))}-error`}
                  message={errors[key('slots')]}
                />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor={availabilityFieldId(key('notes'))}>Note for the team</Label>
                <Input
                  id={availabilityFieldId(key('notes'))}
                  value={row.notes}
                  placeholder="e.g. Sunday roast service"
                  onChange={(event) => onWeekdayChange(dayOfWeek, { notes: event.target.value })}
                  className={TOUCH_TARGET_CLASS}
                />
              </div>
            </div>
          </details>
        </>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={TOUCH_TARGET_CLASS}
          onClick={() => onCopyDay(dayOfWeek)}
        >
          <Copy data-icon="inline-start" aria-hidden />
          Copy {dayName}’s times to other days
        </Button>
        {view.edited ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={TOUCH_TARGET_CLASS}
            onClick={() => onUndoDay(dayOfWeek)}
          >
            <Undo2 data-icon="inline-start" aria-hidden />
            Undo changes to {dayName}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
