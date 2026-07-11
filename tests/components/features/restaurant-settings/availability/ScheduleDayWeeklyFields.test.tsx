import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ScheduleDayWeeklyFields } from '@/components/features/restaurant-settings/availability/ScheduleDayWeeklyFields';

import { makeWeeklyRow } from '../testUtils';

import type { WeeklyRow } from '@/components/features/restaurant-settings/types';

function renderFields(overrides: Partial<Parameters<typeof ScheduleDayWeeklyFields>[0]> = {}) {
  const onWeeklyChange = vi.fn();
  const row = makeWeeklyRow() as WeeklyRow;
  render(
    <ScheduleDayWeeklyFields onWeeklyChange={onWeeklyChange} row={row} rowErrors={undefined} {...overrides} />,
  );
  return { onWeeklyChange, row };
}

describe('ScheduleDayWeeklyFields', () => {
  it('@smoke renders operating hours and booking rule fields with current values', () => {
    renderFields();

    expect(screen.getByLabelText('Opens')).toHaveValue('11:00');
    expect(screen.getByLabelText('Closes')).toHaveValue('22:00');
    expect(screen.getByLabelText('Interval (min)')).toHaveValue(30);
    expect(screen.getByLabelText('Slot times')).toHaveValue('');
    expect(screen.getByLabelText('Notes')).toBeInTheDocument();
  });

  it('@contract patches opening time changes by day index', () => {
    const { onWeeklyChange, row } = renderFields();

    fireEvent.change(screen.getByLabelText('Opens'), { target: { value: '10:00' } });

    expect(onWeeklyChange).toHaveBeenCalledWith(row.dayOfWeek, { opensAt: '10:00' });
  });

  it('@contract patches slot times and notes as text edits', async () => {
    const user = userEvent.setup();
    const { onWeeklyChange, row } = renderFields();

    fireEvent.change(screen.getByLabelText('Slot times'), { target: { value: '12:00, 12:30' } });
    expect(onWeeklyChange).toHaveBeenCalledWith(row.dayOfWeek, {
      reservationSlotTimes: '12:00, 12:30',
    });

    await user.type(screen.getByLabelText('Notes'), 'Q');
    expect(onWeeklyChange).toHaveBeenLastCalledWith(row.dayOfWeek, { notes: 'Q' });
  });

  it('@contract @a11y shows validation errors on the affected inputs', () => {
    renderFields({
      rowErrors: {
        opensAt: 'Opening time is required',
        reservationIntervalMinutes: 'Interval must be at least 1',
      },
    });

    expect(screen.getByLabelText('Opens')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Opening time is required')).toBeInTheDocument();
    expect(screen.getByText('Interval must be at least 1')).toBeInTheDocument();
  });
});
