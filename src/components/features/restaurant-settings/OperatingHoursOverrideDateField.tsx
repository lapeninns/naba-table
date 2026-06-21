'use client';

import { RestaurantSettingsDatePickerField } from './RestaurantSettingsDatePickerField';

type OperatingHoursOverrideDateFieldProps = {
  value: string;
  disabled?: boolean;
  error?: string;
  onChange: (value: string) => void;
};

export function OperatingHoursOverrideDateField({
  value,
  disabled = false,
  error,
  onChange,
}: OperatingHoursOverrideDateFieldProps) {
  return (
    <RestaurantSettingsDatePickerField
      label="Date"
      value={value}
      disabled={disabled}
      error={error}
      onChange={onChange}
    />
  );
}
