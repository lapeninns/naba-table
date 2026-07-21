'use client';

import { ClockIcon } from 'lucide-react';
import { Fragment, useEffect, useId, useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/typography';
import { cn } from '@/lib/utils';

import type { TimeSlotDescriptor } from '@reserve/features/reservations/wizard/services/timeSlots';

const TIME_DESCRIPTION = 'Choose the time that works best for this booking.';

export function ScheduleTimeControl({
  value,
  onChange,
  onBlur,
  error,
  suggestions,
  intervalMinutes,
  isTimeDisabled,
  isTimeLoading,
  unavailableMessage,
}: {
  value: string;
  onChange: (value: string, options?: { commit?: boolean }) => void;
  onBlur?: () => void;
  error?: string;
  suggestions: TimeSlotDescriptor[];
  intervalMinutes?: number;
  isTimeDisabled?: boolean;
  isTimeLoading?: boolean;
  unavailableMessage?: string;
}) {
  const [hasHydrated, setHasHydrated] = useState(false);
  const baseId = useId();
  const timeInputId = `${baseId}-input`;
  const timeDescriptionId = `${baseId}-description`;
  const timeErrorId = error ? `${baseId}-error` : undefined;
  const timeLabelId = `${baseId}-label`;
  const resolvedIntervalMinutes =
    typeof intervalMinutes === 'number' && intervalMinutes > 0 ? intervalMinutes : undefined;
  const timeStepSeconds = hasHydrated
    ? Math.max(60, Math.round((resolvedIntervalMinutes ?? 1) * 60))
    : 60;
  const enabledSuggestions = useMemo(
    () => suggestions.filter((slot) => !slot.disabled),
    [suggestions],
  );
  const groupedSuggestions = useMemo(() => {
    const groups = new Map<string, TimeSlotDescriptor[]>();
    enabledSuggestions.forEach((slot) => {
      const existing = groups.get(slot.label);
      if (existing) {
        existing.push(slot);
      } else {
        groups.set(slot.label, [slot]);
      }
    });
    return groups;
  }, [enabledSuggestions]);
  const showSuggestions = hasHydrated && !isTimeDisabled && enabledSuggestions.length > 0;
  const inputValue = value ?? '';

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  return (
    <div className={cn('flex flex-col gap-3', isTimeLoading && 'opacity-50')}>
      <Label
        htmlFor={timeInputId}
        id={timeLabelId}
        className="flex items-center gap-1.5 px-1 text-sm font-semibold"
      >
        <ClockIcon className="size-4 text-muted-foreground" aria-hidden="true" />
        <span>Time</span>
      </Label>
      <div className="flex flex-col gap-2">
        <div className="relative">
          {showSuggestions ? (
            <Select
              name="reservation-time"
              value={inputValue}
              onValueChange={(next) => onChange(next, { commit: true })}
              disabled={isTimeDisabled || isTimeLoading}
            >
              <SelectTrigger
                id={timeInputId}
                className={cn(
                  'h-12 w-full rounded-[var(--pg-radius-md)] border-border bg-background px-4 text-base font-semibold text-foreground shadow-[var(--pg-shadow-soft)] hover:bg-muted/40 focus:ring-ring/25',
                  !inputValue && 'text-muted-foreground',
                  error && 'border-destructive focus-visible:ring-destructive',
                )}
                aria-invalid={Boolean(error)}
                aria-labelledby={timeLabelId}
                aria-describedby={
                  [timeDescriptionId, timeErrorId].filter(Boolean).join(' ') || undefined
                }
              >
                <SelectValue placeholder="--:--" />
              </SelectTrigger>
              <SelectContent
                className="pg-panel max-h-[min(22rem,var(--radix-select-content-available-height))] w-[var(--radix-select-trigger-width)] min-w-[var(--radix-select-trigger-width)] rounded-[var(--pg-radius-lg)] border-border p-1 shadow-[var(--pg-shadow-floating)]"
                position="popper"
                sideOffset={8}
              >
                {[...groupedSuggestions.entries()].map(([label, slots], index) => (
                  <Fragment key={label}>
                    {index > 0 ? <SelectSeparator className="my-1 bg-border/70" /> : null}
                    <SelectGroup>
                      <SelectLabel className="px-3 py-2 font-[var(--pg-font-mono)] text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                        {label}
                      </SelectLabel>
                      {slots.map((slot) => (
                        <SelectItem
                          key={slot.value}
                          value={slot.value}
                          className="my-0.5 rounded-[var(--pg-radius-sm)] py-2.5 pl-8 pr-3 font-[var(--pg-font-mono)] text-sm font-semibold focus:bg-muted focus:text-foreground data-[state=checked]:bg-muted data-[state=checked]:text-foreground"
                        >
                          {slot.display}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </Fragment>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <>
              <Input
                id={timeInputId}
                name="reservation-time"
                type="time"
                value={isTimeDisabled && unavailableMessage ? '' : inputValue}
                step={timeStepSeconds}
                onChange={(event) => {
                  if (isTimeDisabled) {
                    return;
                  }
                  onChange(event.target.value, { commit: false });
                }}
                onBlur={(event) => {
                  if (isTimeDisabled) {
                    onBlur?.();
                    return;
                  }
                  onBlur?.();
                  onChange(event.target.value, { commit: true });
                }}
                aria-invalid={Boolean(error)}
                aria-labelledby={timeLabelId}
                aria-describedby={
                  [timeDescriptionId, timeErrorId].filter(Boolean).join(' ') || undefined
                }
                placeholder="--:--"
                className={cn(
                  'h-12 appearance-none bg-background text-base font-normal [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none',
                  error && 'border-destructive focus-visible:ring-destructive',
                )}
                disabled={isTimeDisabled || isTimeLoading}
              />
              {!inputValue && !isTimeLoading && !isTimeDisabled ? (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-muted-foreground"
                >
                  --:--
                </span>
              ) : null}
            </>
          )}

          {isTimeLoading && !inputValue ? (
            <div className="pointer-events-none absolute inset-0 flex items-center px-3">
              <Skeleton className="h-5 w-20" />
            </div>
          ) : null}
        </div>

        {!showSuggestions ? (
          <Text variant="caption" className="px-1" aria-live="polite">
            {unavailableMessage ?? 'No available times for the selected date.'}
          </Text>
        ) : null}
      </div>
      <Text variant="caption" id={timeDescriptionId} className="px-1">
        {TIME_DESCRIPTION}
      </Text>
      {error ? (
        <p
          id={timeErrorId}
          className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium leading-tight text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
