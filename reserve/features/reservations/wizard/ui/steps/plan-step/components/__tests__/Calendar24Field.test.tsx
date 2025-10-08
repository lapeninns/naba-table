import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Calendar24Field } from '../Calendar24Field';

import type { TimeSlotDescriptor } from '@reserve/features/reservations/wizard/services';
import type { ReservationTime } from '@reserve/shared/time';

const suggestions: TimeSlotDescriptor[] = [
  {
    value: '18:00' as ReservationTime,
    display: '6:00 PM',
    label: 'Dinner',
    disabled: false,
    availability: {
      services: { lunch: 'disabled', dinner: 'enabled', drinks: 'enabled' },
      labels: {
        happyHour: false,
        drinksOnly: false,
        kitchenClosed: false,
        lunchWindow: false,
        dinnerWindow: true,
      },
    },
    defaultBookingOption: 'dinner',
  },
];

describe('<Calendar24Field />', () => {
  it('invokes onSelect when a date is chosen from the calendar', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();

    render(
      <Calendar24Field
        date={{
          value: '',
          minDate: new Date('2025-05-01T00:00:00Z'),
          onSelect,
        }}
        time={{ value: '18:00', onChange: vi.fn() }}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Date' }));
    const dayCell = (await screen.findAllByRole('gridcell')).find(
      (cell) => cell.textContent?.trim() === '15',
    );
    expect(dayCell).toBeDefined();
    const dayButton = dayCell?.querySelector('button');
    if (dayButton) {
      await user.click(dayButton);
    }

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('invokes onChange when time is typed', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(
      <Calendar24Field
        date={{ value: '2025-05-15', minDate: new Date('2025-05-01'), onSelect: vi.fn() }}
        time={{ value: '', onChange }}
      />,
    );

    const timeInput = screen.getByLabelText('Time');
    await user.type(timeInput, '19:00');

    expect(onChange).toHaveBeenCalledWith('19:00', { commit: false });
  });

  it('renders time suggestions as datalist options when provided', () => {
    render(
      <Calendar24Field
        date={{ value: '2025-05-15', minDate: new Date('2025-05-01'), onSelect: vi.fn() }}
        time={{ value: '18:00', onChange: vi.fn() }}
        suggestions={suggestions}
      />,
    );

    const option = document.querySelector('datalist option');
    expect(option).toBeTruthy();
    expect(option?.getAttribute('value')).toBe('18:00');
  });
});
