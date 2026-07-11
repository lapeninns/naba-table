import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RestaurantSettingsDatePickerField } from '@/components/features/restaurant-settings/RestaurantSettingsDatePickerField';

describe('RestaurantSettingsDatePickerField', () => {
  beforeEach(() => {
    // Pin time so the "no value" default month and formatted labels are deterministic.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 6, 11, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('@smoke shows the placeholder when no value is set', () => {
    render(<RestaurantSettingsDatePickerField label="Date" value="" onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: /Date/i })).toHaveTextContent('Select date');
  });

  it('@contract formats a valid value on the trigger button', () => {
    render(<RestaurantSettingsDatePickerField label="Date" value="2026-07-11" onChange={vi.fn()} />);

    // Sat Jul 11 2026 in the default locale formatter.
    expect(screen.getByRole('button', { name: /Date/i })).toHaveTextContent(/Jul 11, 2026/);
  });

  it('@contract fires onChange with an ISO date when a calendar day is picked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RestaurantSettingsDatePickerField label="Date" value="2026-07-11" onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /Date/i }));
    await user.click(await screen.findByRole('button', { name: /July 15th, 2026/i }));

    expect(onChange).toHaveBeenCalledWith('2026-07-15');
  });

  it('@contract @a11y wires error text to the trigger and marks it invalid', () => {
    render(
      <RestaurantSettingsDatePickerField
        label="Date"
        value=""
        onChange={vi.fn()}
        error="Pick a date"
      />,
    );

    const trigger = screen.getByRole('button', { name: /Date/i });
    expect(trigger).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Pick a date')).toBeInTheDocument();
  });

  it('@contract disables the trigger when disabled', () => {
    render(
      <RestaurantSettingsDatePickerField label="Date" value="" onChange={vi.fn()} disabled />,
    );

    expect(screen.getByRole('button', { name: /Date/i })).toBeDisabled();
  });
});
