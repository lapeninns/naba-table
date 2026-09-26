'use client';

import { AlertTriangle, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

import {
  parseIntervalInput,
  parseSlotTimesInput,
  toComparableTime,
} from '../availabilityScheduleTime';
import { FieldErrorText, TOUCH_TARGET_CLASS } from './AvailabilityFields';
import { MEAL_KEYS, MEAL_LABEL, formatOverrideDate } from './availabilityPageDraft';
import { overrideFieldKey, type AvailabilityErrors } from './availabilityPageValidation';
import { SettingsDialog } from '../shared/SettingsDialog';
import { pluralise } from '../shared/settingsSaveSequence';

import type { OverrideRow } from '../types';
import type { GuestPreviewResult } from '@/lib/restaurants/guest-schedule/preview';

export const SPECIAL_DATES_SECTION_ID = 'special-dates';

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);

function relativeDay(today: string, date: string): string {
  const days = daysBetween(today, date);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days > 1) return `In ${days} days`;
  return days === -1 ? 'Yesterday' : `${-days} days ago`;
}

/** "Lunch: 6 times · Dinner: none (party of 2)" */
export function describeOverrideEffect(
  row: OverrideRow,
  result: GuestPreviewResult | null,
): string {
  if (row.isClosed) {
    return 'Closed all day. No times offered.';
  }
  if (!result || result.isClosed) {
    return `Open ${row.opensAt || '—'}–${row.closesAt || '—'}.`;
  }
  const counts = MEAL_KEYS.map((meal) => {
    const count = result.offered.filter((slot) => slot.bookingOption === meal).length;
    return `${MEAL_LABEL[meal]}: ${count > 0 ? pluralise(count, 'time') : 'none'}`;
  });
  return `Open ${row.opensAt}–${row.closesAt}. ${counts.join(' · ')} (party of 2)`;
}

type SpecialDatesSectionProps = {
  rows: OverrideRow[];
  savedRows: OverrideRow[];
  today: string;
  errors: AvailabilityErrors;
  previewFor: (row: OverrideRow) => GuestPreviewResult | null;
  onAdd: () => void;
  onEdit: (id: string) => void;
  onRemove: (id: string) => void;
};

export function SpecialDatesSection({
  rows,
  savedRows,
  today,
  errors,
  previewFor,
  onAdd,
  onEdit,
  onRemove,
}: SpecialDatesSectionProps) {
  const sorted = useMemo(
    () => [...rows].sort((left, right) => left.effectiveDate.localeCompare(right.effectiveDate)),
    [rows],
  );
  const upcoming = sorted.filter((row) => !row.effectiveDate || row.effectiveDate >= today);
  const past = sorted.filter((row) => row.effectiveDate && row.effectiveDate < today);

  const renderRow = (row: OverrideRow) => {
    const id = row.id ?? row.effectiveDate;
    const savedRow = savedRows.find((item) => item.id === row.id);
    const state = !savedRow
      ? 'Added'
      : JSON.stringify(savedRow) !== JSON.stringify(row)
        ? 'Edited'
        : null;
    const rowErrors = Object.entries(errors)
      .filter(([key]) => key.startsWith(`o-${id}-`))
      .map(([, message]) => message);
    const dateLabel = formatOverrideDate(row.effectiveDate);
    return (
      <li
        key={id}
        className="grid gap-x-4 gap-y-2 px-4 py-3 sm:grid-cols-[9.5rem_minmax(0,1fr)_auto] sm:items-start sm:px-5"
      >
        <div>
          <p className="font-semibold tabular-nums text-foreground">{dateLabel}</p>
          <p className="text-xs text-muted-foreground">
            {row.effectiveDate ? relativeDay(today, row.effectiveDate) : ''}
          </p>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-foreground">
            <span className="min-w-0 break-words">{row.notes || 'Special date'}</span>
            <Badge variant="secondary">{row.isClosed ? 'Closed' : 'Different hours'}</Badge>
            {state ? <Badge variant="status-pending">{state}</Badge> : null}
            {rowErrors.length > 0 ? (
              <Badge variant="status-cancelled" className="gap-1">
                <AlertTriangle className="size-3" aria-hidden />
                {rowErrors[0]}
              </Badge>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground tabular-nums">
            {describeOverrideEffect(row, previewFor(row))}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={TOUCH_TARGET_CLASS}
            aria-label={`Edit ${dateLabel}`}
            onClick={() => onEdit(id)}
          >
            Edit
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className={TOUCH_TARGET_CLASS}
            aria-label={`Remove ${dateLabel}`}
            onClick={() => onRemove(id)}
          >
            <Trash2 aria-hidden />
          </Button>
        </div>
      </li>
    );
  };

  return (
    <Card
      id={SPECIAL_DATES_SECTION_ID}
      aria-labelledby="availability-dates-heading"
      className="scroll-mt-4 overflow-hidden border-border/70 shadow-none"
    >
      <CardHeader className="flex flex-col gap-3 border-b border-border/60 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
        <div className="flex min-w-0 flex-col gap-1">
          <CardTitle
            id="availability-dates-heading"
            role="heading"
            aria-level={2}
            className="text-base leading-6"
          >
            Special dates
          </CardTitle>
          <CardDescription>
            Closures and different hours for one date. Meal times still follow that weekday.
          </CardDescription>
        </div>
        <Button
          type="button"
          variant="outline"
          className={cn('shrink-0', TOUCH_TARGET_CLASS)}
          onClick={onAdd}
          data-special-date-add
        >
          <Plus data-icon="inline-start" aria-hidden />
          Add special date
        </Button>
      </CardHeader>
      {sorted.length === 0 ? (
        <div className="flex flex-col items-start gap-2 px-4 py-6 sm:px-5">
          <p className="font-medium text-foreground">No special dates</p>
          <p className="max-w-[65ch] text-sm text-muted-foreground">
            Add a closure or different hours for a bank holiday, private event or Christmas. Your
            weekly hours apply until then.
          </p>
          <Button type="button" className={TOUCH_TARGET_CLASS} onClick={onAdd}>
            <Plus data-icon="inline-start" aria-hidden />
            Add special date
          </Button>
        </div>
      ) : (
        <>
          {upcoming.length > 0 ? (
            <ul className="divide-y divide-border/60">{upcoming.map(renderRow)}</ul>
          ) : (
            <p className="px-4 py-4 text-sm text-muted-foreground sm:px-5">
              No upcoming special dates.
            </p>
          )}
          {past.length > 0 ? (
            <details className="group border-t border-border/60">
              <summary className="flex cursor-pointer list-none items-center gap-1.5 px-4 py-3 text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/30 sm:px-5 [&::-webkit-details-marker]:hidden">
                <ChevronRight
                  className="size-4 transition-transform group-open:rotate-90 motion-reduce:transition-none"
                  aria-hidden
                />
                Past dates ({past.length})
              </summary>
              <ul className="divide-y divide-border/60 border-t border-border/60">
                {past.map(renderRow)}
              </ul>
            </details>
          ) : null}
        </>
      )}
    </Card>
  );
}

type SpecialDateDialogProps = {
  open: boolean;
  row: OverrideRow | null;
  isNew: boolean;
  /** Show every error straight away (opened from "Show first issue"). */
  revealErrors?: boolean;
  today: string;
  otherDates: string[];
  onOpenChange: (open: boolean) => void;
  previewFor: (row: OverrideRow) => GuestPreviewResult | null;
  onApply: (row: OverrideRow) => void;
};

type DateErrors = Partial<Record<'date' | 'opens' | 'closes' | 'interval' | 'slots', string>>;

function validateSpecialDate(row: OverrideRow, otherDates: string[]): DateErrors {
  const errors: DateErrors = {};
  if (!row.effectiveDate) {
    errors.date = 'Choose a date';
  } else if (otherDates.includes(row.effectiveDate)) {
    errors.date = `${formatOverrideDate(row.effectiveDate)} already has a special date. Edit that one instead.`;
  }
  if (!row.isClosed) {
    const opens = toComparableTime(row.opensAt);
    const closes = toComparableTime(row.closesAt);
    if (!opens) errors.opens = 'Enter an opening time';
    if (!closes) errors.closes = 'Enter a closing time';
    if (opens && closes && closes <= opens) errors.closes = 'Closing must be after opening';
  }
  if (parseIntervalInput(row.reservationIntervalMinutes).error) {
    errors.interval = 'Whole number from 1 to 180';
  }
  if (parseSlotTimesInput(row.reservationSlotTimes).error) {
    errors.slots = 'Use 24-hour times separated by commas';
  }
  return errors;
}

export function SpecialDateDialog({
  open,
  row,
  isNew,
  revealErrors = false,
  today,
  otherDates,
  onOpenChange,
  previewFor,
  onApply,
}: SpecialDateDialogProps) {
  const [form, setForm] = useState<OverrideRow | null>(row);
  const [attempted, setAttempted] = useState(false);
  const [lastRow, setLastRow] = useState(row);
  if (row !== lastRow) {
    setLastRow(row);
    setForm(row);
    setAttempted(false);
  }
  if (!form) {
    return null;
  }
  const errors = validateSpecialDate(form, otherDates);
  const shown =
    attempted || revealErrors ? errors : { date: form.effectiveDate ? errors.date : undefined };
  const patch = (next: Partial<OverrideRow>) =>
    setForm((current) => (current ? { ...current, ...next } : current));
  const fieldId = (field: string) => `availability-${overrideFieldKey('dialog', field)}`;
  const effect = (() => {
    if (!form.effectiveDate || errors.date || errors.opens || errors.closes) {
      return 'Choose a date to see what guests will be offered.';
    }
    const dateLabel = formatOverrideDate(form.effectiveDate, 'long');
    if (form.isClosed) {
      return `${dateLabel}: closed. Guests can’t request any times.`;
    }
    const result = previewFor(form);
    if (!result || result.isClosed) {
      return `${dateLabel}: closed. Guests can’t request any times.`;
    }
    const meals = MEAL_KEYS.map((meal) => {
      const times = result.offered
        .filter((slot) => slot.bookingOption === meal)
        .map((slot) => slot.value);
      return times.length
        ? `${MEAL_LABEL[meal]} ${times[0]}–${times[times.length - 1]} (${pluralise(times.length, 'time')})`
        : `${MEAL_LABEL[meal]}: none`;
    });
    return `${dateLabel}, party of 2: ${meals.join('. ')}.`;
  })();

  const submit = () => {
    setAttempted(true);
    const firstError = (Object.keys(errors) as Array<keyof DateErrors>)[0];
    if (firstError) {
      if (firstError === 'interval' || firstError === 'slots') {
        document.getElementById(fieldId('more'))?.setAttribute('open', '');
      }
      document.getElementById(fieldId(firstError))?.focus();
      return;
    }
    onApply(form);
  };

  return (
    <SettingsDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isNew ? 'Add special date' : 'Edit special date'}
      description="Changes one date only. Your weekly hours stay the same."
      testId="availability-special-date-dialog"
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={submit}>
            {isNew ? 'Add date' : 'Update date'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={fieldId('date')}>Date</Label>
        <Input
          id={fieldId('date')}
          type="date"
          min={isNew ? today : undefined}
          value={form.effectiveDate}
          onChange={(event) => patch({ effectiveDate: event.target.value })}
          aria-invalid={Boolean(shown.date) || undefined}
          aria-describedby={`${fieldId('date')}-error`}
          className={TOUCH_TARGET_CLASS}
        />
        <FieldErrorText id={`${fieldId('date')}-error`} message={shown.date} />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-foreground">On this date</legend>
        {[
          { value: true, title: 'Closed all day', detail: 'No times offered.' },
          {
            value: false,
            title: 'Different opening hours',
            detail: 'Lunch and dinner still follow the usual times for that weekday.',
          },
        ].map((option) => (
          <Label
            key={option.title}
            className="flex cursor-pointer items-start gap-3 rounded-md border border-border/70 p-3 font-normal has-[:checked]:border-primary has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/30"
          >
            <Input
              type="radio"
              name="availability-special-date-mode"
              className="mt-1 size-4 shrink-0 p-0 accent-primary shadow-none"
              checked={form.isClosed === option.value}
              onChange={() => patch({ isClosed: option.value })}
            />
            <span className="flex flex-col">
              <span className="text-sm font-medium text-foreground">{option.title}</span>
              <span className="text-xs text-muted-foreground">{option.detail}</span>
            </span>
          </Label>
        ))}
      </fieldset>
      {form.isClosed ? null : (
        <div className="grid gap-3 sm:grid-cols-2">
          {(['opens', 'closes'] as const).map((field) => (
            <div key={field} className="flex flex-col gap-1.5">
              <Label htmlFor={fieldId(field)}>{field === 'opens' ? 'Opens' : 'Closes'}</Label>
              <Input
                id={fieldId(field)}
                type="time"
                step={300}
                value={field === 'opens' ? form.opensAt : form.closesAt}
                onChange={(event) =>
                  patch(
                    field === 'opens'
                      ? { opensAt: event.target.value }
                      : { closesAt: event.target.value },
                  )
                }
                aria-invalid={Boolean(shown[field]) || undefined}
                aria-describedby={`${fieldId(field)}-error`}
                className={cn('tabular-nums', TOUCH_TARGET_CLASS)}
              />
              <FieldErrorText id={`${fieldId(field)}-error`} message={shown[field]} />
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={fieldId('notes')}>
          Reason <span className="font-normal text-muted-foreground">Optional, for your team</span>
        </Label>
        <Input
          id={fieldId('notes')}
          value={form.notes}
          placeholder="e.g. Christmas Eve"
          onChange={(event) => patch({ notes: event.target.value })}
          className={TOUCH_TARGET_CLASS}
        />
      </div>
      <details
        id={fieldId('more')}
        className="group"
        open={Boolean(form.reservationIntervalMinutes || form.reservationSlotTimes) || undefined}
      >
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 py-1 text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 [&::-webkit-details-marker]:hidden">
          <ChevronRight
            className="size-4 transition-transform group-open:rotate-90 motion-reduce:transition-none"
            aria-hidden
          />
          Slot spacing for this date
        </summary>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={fieldId('interval')}>Time between booking slots</Label>
            <Input
              id={fieldId('interval')}
              inputMode="numeric"
              value={form.reservationIntervalMinutes}
              placeholder="Usual for that day"
              onChange={(event) => patch({ reservationIntervalMinutes: event.target.value })}
              aria-invalid={Boolean(shown.interval) || undefined}
              aria-describedby={`${fieldId('interval')}-error`}
              className={TOUCH_TARGET_CLASS}
            />
            <FieldErrorText id={`${fieldId('interval')}-error`} message={shown.interval} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={fieldId('slots')}>Fixed start times</Label>
            <Input
              id={fieldId('slots')}
              value={form.reservationSlotTimes}
              placeholder="e.g. 12:00, 12:30"
              onChange={(event) => patch({ reservationSlotTimes: event.target.value })}
              aria-invalid={Boolean(shown.slots) || undefined}
              aria-describedby={`${fieldId('slots')}-error`}
              className={cn('font-mono', TOUCH_TARGET_CLASS)}
            />
            <FieldErrorText id={`${fieldId('slots')}-error`} message={shown.slots} />
          </div>
        </div>
      </details>
      <p className="rounded-md bg-muted/60 px-3 py-2.5 text-sm tabular-nums" aria-live="polite">
        {effect}
      </p>
    </SettingsDialog>
  );
}
