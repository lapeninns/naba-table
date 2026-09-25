'use client';

import { MinutesStepper } from './AvailabilityFields';
import { BOOKING_RULE_LIMITS, type AvailabilityErrors } from './availabilityPageValidation';

type DefaultTableTimeFieldProps = {
  value: string;
  errors: AvailabilityErrors;
  onChange: (value: string) => void;
  onTouch: (key: string) => void;
};

/**
 * The restaurant's default table time, the one place it is edited. It sits above the booking
 * types because each type's own table time, and its party-size times, are set below it.
 */
export function DefaultTableTimeField({
  value,
  errors,
  onChange,
  onTouch,
}: DefaultTableTimeFieldProps) {
  return (
    <div className="border-b border-border/60 px-4 pb-4 sm:px-5">
      <div className="max-w-md">
        <MinutesStepper
          errorKey="r-duration"
          label="Default table time"
          labelText="Default table time"
          value={value}
          step={15}
          min={BOOKING_RULE_LIMITS['r-duration']!.min}
          max={BOOKING_RULE_LIMITS['r-duration']!.max}
          error={errors['r-duration']}
          hint="Pre-fills bookings staff create. Guest table times are set for each booking type below."
          onChange={onChange}
          onBlur={() => onTouch('r-duration')}
        />
      </div>
    </div>
  );
}
