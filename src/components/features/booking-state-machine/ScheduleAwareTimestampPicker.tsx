'use client';

import { type ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { ScheduleDateControl } from './ScheduleDateControl';
import { ScheduleTimeControl } from './ScheduleTimeControl';
import { useScheduleAwareTimestampPicker } from './useScheduleAwareTimestampPicker';

export type ScheduleAwareTimestampPickerProps = {
  restaurantSlug: string | null | undefined;
  restaurantTimezone?: string | null;
  value: string | null;
  onChange: (value: string | null) => void;
  onDateChange?: (dateIso: string | null) => void;
  onBlur?: () => void;
  label?: string;
  description?: string;
  errorMessage?: string | null;
  disabled?: boolean;
  minDate?: Date;
  className?: string;
  /** When editing a booking of a specific type (e.g. 'lunch'), filter slots where this service is enabled */
  targetService?: string | null;

  children?: ReactNode;
};

export function ScheduleAwareTimestampPicker({
  restaurantSlug,
  restaurantTimezone,
  value,
  onChange,
  onDateChange,
  onBlur,
  label,
  description,
  errorMessage,
  disabled = false,
  minDate,
  className,
  targetService,
  children,
}: ScheduleAwareTimestampPickerProps) {
  const picker = useScheduleAwareTimestampPicker({
    disabled,
    errorMessage,
    minDate,
    onBlur,
    onChange,
    onDateChange,
    restaurantSlug,
    restaurantTimezone,
    targetService,
    value,
  });

  return (
    <div className={cn('flex flex-col gap-6', className)}>
      <div className="flex flex-col gap-3">
        {label ? (
          <span className="text-xs font-semibold uppercase text-muted-foreground">{label}</span>
        ) : null}
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}

        <div className="rounded-2xl border border-border/70 bg-background/70 shadow-sm">
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <div className="bg-card">
              <ScheduleDateControl
                value={picker.activeDate}
                minDate={picker.fallbackMinDate}
                onSelect={picker.handleDateSelect}
                onBlur={onBlur}
                error={picker.dateErrorMessage}
                onMonthChange={picker.handleMonthPrefetch}
                isDateUnavailable={picker.isDateDisabled}
                loadingDates={picker.loadingDates}
              />
            </div>

            {children ? <div className="bg-card">{children}</div> : null}

            <div className="bg-card sm:col-span-2">
              <ScheduleTimeControl
                value={picker.draftTime}
                onChange={picker.handleTimeChange}
                onBlur={onBlur}
                error={picker.resolvedTimeErrorMessage}
                suggestions={picker.availableSlots}
                intervalMinutes={picker.intervalMinutes}
                isTimeDisabled={picker.isTimeDisabled}
                isTimeLoading={picker.isScheduleLoading}
                unavailableMessage={picker.unavailableMessageForTime}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
