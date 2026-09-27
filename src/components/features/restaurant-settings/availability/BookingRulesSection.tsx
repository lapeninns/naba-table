'use client';

import { ChevronRight } from 'lucide-react';
import { useState } from 'react';

import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { toComparableTime } from '../availabilityScheduleTime';
import { SettingsCard } from '../shared/SettingsCard';
import { SettingsDirtyBadge } from '../shared/SettingsDirtyBadge';
import { DAYS_OF_WEEK, type WeeklyRow } from '../types';
import { FieldErrorText, MinutesStepper } from './AvailabilityFields';
import { WEEK_ORDER, type BookingRulesDraft } from './availabilityPageDraft';
import {
  availabilityFieldId,
  BOOKING_RULE_LIMITS,
  type AvailabilityErrors,
} from './availabilityPageValidation';

export const BOOKING_RULES_SECTION_ID = 'booking-rules';

const inRange = (value: string, key: string) => {
  const limits = BOOKING_RULE_LIMITS[key];
  const parsed = Number(value.trim());
  return Boolean(
    limits &&
    value.trim() &&
    Number.isInteger(parsed) &&
    parsed >= limits.min &&
    parsed <= limits.max,
  );
};

/** "On Tuesdays that means last seating at 21:00." — uses the first open weekday. */
function lastSeatingExample(weeklyRows: readonly WeeklyRow[], buffer: number): string | null {
  const preferred = [2, ...WEEK_ORDER];
  for (const dayOfWeek of preferred) {
    const row = weeklyRows.find((item) => item.dayOfWeek === dayOfWeek);
    const close = toComparableTime(row?.closesAt ?? null);
    if (!row || row.isClosed || !close) continue;
    const [hours, minutes] = close.split(':').map(Number);
    const cut = Math.max(0, (hours ?? 0) * 60 + (minutes ?? 0) - buffer);
    const time = `${String(Math.floor(cut / 60)).padStart(2, '0')}:${String(cut % 60).padStart(2, '0')}`;
    return `On ${DAYS_OF_WEEK[dayOfWeek]}s that means last seating at ${time}.`;
  }
  return null;
}

type BookingRulesSectionProps = {
  rules: BookingRulesDraft;
  weeklyRows: readonly WeeklyRow[];
  edited: boolean;
  errors: AvailabilityErrors;
  onChange: (patch: Partial<BookingRulesDraft>) => void;
  onTouch: (key: string) => void;
};

export function BookingRulesSection({
  rules,
  weeklyRows,
  edited,
  errors,
  onChange,
  onTouch,
}: BookingRulesSectionProps) {
  const interval = rules.reservationIntervalMinutes.trim();
  const buffer = rules.reservationLastSeatingBufferMinutes.trim();
  const advancedOpen = Boolean(errors['r-grace']);
  // The grace period and policy fields are only rendered while the disclosure is open, so a
  // closed disclosure leaves no hidden textarea laid out over the cards below it.
  const [disclosureOpen, setDisclosureOpen] = useState(false);
  const showAdvanced = disclosureOpen || advancedOpen;
  return (
    <SettingsCard
      id={BOOKING_RULES_SECTION_ID}
      region
      titleId="availability-rules-heading"
      title="Booking rules"
      description="How often times are offered and how late guests can be seated."
      badges={edited ? <SettingsDirtyBadge /> : null}
      contentClassName="flex flex-col gap-4 @container"
    >
      <div className="grid gap-4 @xl:grid-cols-2">
        <MinutesStepper
          errorKey="r-interval"
          label="Time between booking slots"
          labelText="Time between booking slots"
          value={rules.reservationIntervalMinutes}
          step={5}
          min={BOOKING_RULE_LIMITS['r-interval']!.min}
          max={BOOKING_RULE_LIMITS['r-interval']!.max}
          error={errors['r-interval']}
          hint={
            inRange(interval, 'r-interval')
              ? `Guests see a time every ${interval} minutes inside meal times. A day can override this.`
              : 'From 1 to 180 minutes.'
          }
          onChange={(value) => onChange({ reservationIntervalMinutes: value })}
          onBlur={() => onTouch('r-interval')}
        />
        <MinutesStepper
          errorKey="r-buffer"
          label="Last seating before closing"
          labelText="Last seating before closing"
          value={rules.reservationLastSeatingBufferMinutes}
          step={15}
          min={BOOKING_RULE_LIMITS['r-buffer']!.min}
          max={BOOKING_RULE_LIMITS['r-buffer']!.max}
          error={errors['r-buffer']}
          hint={
            inRange(buffer, 'r-buffer')
              ? [
                  `No one is seated in the last ${buffer} minutes.`,
                  lastSeatingExample(weeklyRows, Number(buffer)),
                ]
                  .filter(Boolean)
                  .join(' ')
              : 'From 15 to 300 minutes.'
          }
          onChange={(value) => onChange({ reservationLastSeatingBufferMinutes: value })}
          onBlur={() => onTouch('r-buffer')}
        />
      </div>
      <details
        className="group"
        open={showAdvanced || undefined}
        onToggle={(event) => setDisclosureOpen(event.currentTarget.open)}
        id={availabilityFieldId('r-advanced')}
      >
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 py-1 text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 [&::-webkit-details-marker]:hidden">
          <ChevronRight
            className="size-4 transition-transform group-open:rotate-90 motion-reduce:transition-none"
            aria-hidden
          />
          Late grace period and booking policy
        </summary>
        {showAdvanced ? (
          <div className="mt-3 grid gap-4 @xl:grid-cols-2">
            <MinutesStepper
              errorKey="r-grace"
              label="Late grace period"
              labelText="Late grace period"
              value={rules.reservationLifecycleGraceMinutes}
              step={5}
              min={BOOKING_RULE_LIMITS['r-grace']!.min}
              max={BOOKING_RULE_LIMITS['r-grace']!.max}
              error={errors['r-grace']}
              hint="Minutes after a booking ends when staff can still check out or mark a no-show. Doesn’t change guest times."
              onChange={(value) => onChange({ reservationLifecycleGraceMinutes: value })}
              onBlur={() => onTouch('r-grace')}
            />
            <div className="flex flex-col gap-1.5 @xl:col-span-2">
              <Label htmlFor={availabilityFieldId('r-policy')}>
                Booking policy shown to guests{' '}
                <span className="font-normal text-muted-foreground">Optional</span>
              </Label>
              <Textarea
                id={availabilityFieldId('r-policy')}
                value={rules.bookingPolicy}
                rows={3}
                onChange={(event) => onChange({ bookingPolicy: event.target.value })}
                aria-describedby={`${availabilityFieldId('r-policy')}-hint`}
              />
              <p
                id={`${availabilityFieldId('r-policy')}-hint`}
                className="text-xs text-muted-foreground"
              >
                Shown during booking and in confirmations, e.g. grace periods or large-party
                policies.
              </p>
              <FieldErrorText id={`${availabilityFieldId('r-policy')}-error`} />
            </div>
          </div>
        ) : null}
      </details>
    </SettingsCard>
  );
}
