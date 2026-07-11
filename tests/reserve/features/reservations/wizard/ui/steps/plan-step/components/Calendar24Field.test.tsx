import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import {
  Calendar24Date,
  Calendar24Field,
  Calendar24Time,
} from '@features/reservations/wizard/ui/steps/plan-step/components/Calendar24Field';

import type { TimeSlotDescriptor } from '@features/reservations/wizard/services';

const minDate = new Date(2026, 3, 10); // 2026-04-10 local

function makeSlot(overrides: Partial<TimeSlotDescriptor> = {}): TimeSlotDescriptor {
  return {
    value: '19:00',
    display: '19:00',
    label: 'Dinner',
    bookingOption: 'dinner',
    defaultBookingOption: 'dinner',
    availability: {
      services: { dinner: 'enabled' },
      labels: { kitchenClosed: false, lunchWindow: false, dinnerWindow: true },
    },
    disabled: false,
    ...overrides,
  };
}

describe('Calendar24Date', () => {
  it('labels the trigger with the selected date or a prompt @smoke', () => {
    const { rerender } = render(
      <Calendar24Date date={{ value: '', minDate, onSelect: vi.fn() }} />,
    );
    expect(screen.getByRole('button', { name: /Date Select date/ })).toBeInTheDocument();

    rerender(<Calendar24Date date={{ value: '2026-04-14', minDate, onSelect: vi.fn() }} />);
    expect(screen.getByRole('button', { name: /Date .*Apr.*2026/ })).toBeInTheDocument();
  });

  it('opens the calendar and selects an available day @contract', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Calendar24Date date={{ value: '2026-04-14', minDate, onSelect }} />);

    const trigger = screen.getByRole('button', { name: /Date/ });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    const grid = await screen.findByRole('grid');
    await user.click(within(grid).getByRole('button', { name: /April 15th, 2026/ }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    const selected = onSelect.mock.calls[0]?.[0] as Date;
    expect(selected.getFullYear()).toBe(2026);
    expect(selected.getMonth()).toBe(3);
    expect(selected.getDate()).toBe(15);
  });

  it('disables days before the minimum and unavailable days @contract', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <Calendar24Date
        date={{ value: '2026-04-14', minDate, onSelect }}
        isDateUnavailable={(day) => day.getDate() === 20 && day.getMonth() === 3}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Date/ }));
    const grid = await screen.findByRole('grid');

    // 9 April is before the 10 April minimum; 20 April is marked unavailable.
    expect(within(grid).getByRole('button', { name: /April 9th, 2026/ })).toBeDisabled();
    expect(within(grid).getByRole('button', { name: /April 20th, 2026/ })).toBeDisabled();
    expect(within(grid).getByRole('button', { name: /April 15th, 2026/ })).toBeEnabled();
  });

  it('reports the initial month for prefetching @contract', () => {
    const onMonthChange = vi.fn();
    render(
      <Calendar24Date
        date={{ value: '2026-04-14', minDate, onSelect: vi.fn() }}
        onMonthChange={onMonthChange}
      />,
    );

    expect(onMonthChange).toHaveBeenCalled();
    const month = onMonthChange.mock.calls[0]?.[0] as Date;
    expect(month.getFullYear()).toBe(2026);
    expect(month.getMonth()).toBe(3);
    expect(month.getDate()).toBe(1);
  });

  it('announces date errors as alerts @contract @a11y', () => {
    render(
      <Calendar24Date
        date={{ value: '', minDate, onSelect: vi.fn(), error: 'Please select a date.' }}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Please select a date.');
  });
});

describe('Calendar24Time', () => {
  it('renders grouped slot suggestions in a select @contract', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Calendar24Time
        time={{ value: '', onChange }}
        suggestions={[
          makeSlot({ value: '12:00', display: '12:00', label: 'Lunch', bookingOption: 'lunch' }),
          makeSlot(),
          makeSlot({ value: '19:30', display: '19:30', disabled: true }),
        ]}
      />,
    );

    await user.click(screen.getByRole('combobox'));

    expect(await screen.findByText('Lunch')).toBeInTheDocument();
    // Disabled slots are excluded from suggestions entirely.
    expect(screen.queryByRole('option', { name: '19:30' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('option', { name: '19:00' }));
    expect(onChange).toHaveBeenCalledWith('19:00', { commit: true });
  });

  it('falls back to a native time input without suggestions @contract', () => {
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(<Calendar24Time time={{ value: '18:00', onChange, onBlur }} suggestions={[]} />);

    const input = screen.getByLabelText('Time');
    expect(input).toHaveValue('18:00');

    fireEvent.change(input, { target: { value: '19:30' } });
    expect(onChange).toHaveBeenCalledWith('19:30', { commit: false });

    fireEvent.blur(input);
    expect(onBlur).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith('18:00', { commit: true });
  });

  it('disables the input and explains when the venue is closed @contract', () => {
    render(
      <Calendar24Time
        time={{ value: '19:00', onChange: vi.fn() }}
        suggestions={[makeSlot()]}
        isTimeDisabled
        unavailableMessage="We are closed on this date. Please choose a different day."
      />,
    );

    // Suggestions are suppressed while disabled; the fallback input is empty.
    const input = screen.getByLabelText('Time');
    expect(input).toBeDisabled();
    expect(input).toHaveValue('');
    expect(
      screen.getByText('We are closed on this date. Please choose a different day.'),
    ).toBeInTheDocument();
  });

  it('announces time errors as alerts @contract @a11y', () => {
    render(
      <Calendar24Time
        time={{ value: '', onChange: vi.fn(), error: 'Please select a time.' }}
        suggestions={[]}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Please select a time.');
  });
});

describe('Calendar24Field', () => {
  it('composes the date and time fields side by side @smoke', () => {
    render(
      <Calendar24Field
        date={{ value: '2026-04-14', minDate, onSelect: vi.fn() }}
        time={{ value: '19:00', onChange: vi.fn() }}
        suggestions={[]}
      />,
    );

    expect(screen.getByRole('button', { name: /Date/ })).toBeInTheDocument();
    expect(screen.getByLabelText('Time')).toBeInTheDocument();
  });
});
