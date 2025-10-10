import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { TimeSlotGrid } from '../TimeSlotGrid';

import type { TimeSlotDescriptor } from '@reserve/features/reservations/wizard/services';
import type { ReservationTime } from '@reserve/shared/time';

const buildSlot = (overrides: Partial<TimeSlotDescriptor> = {}): TimeSlotDescriptor => ({
  value: '18:00' as ReservationTime,
  display: '6:00 PM',
  label: 'Dinner',
  disabled: false,
  periodId: 'sp-test',
  bookingOption: 'dinner',
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
  ...overrides,
});

describe('<TimeSlotGrid />', () => {
  it('renders grouped time buttons and invokes onSelect', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();

    render(
      <TimeSlotGrid
        value=""
        onSelect={onSelect}
        slots={[
          buildSlot({ value: '12:15' as ReservationTime, display: '12:15 PM', label: 'Lunch' }),
          buildSlot({ value: '18:00' as ReservationTime, display: '6:00 PM', label: 'Dinner' }),
        ]}
      />,
    );

    expect(screen.getByText(/Lunch/i)).toBeInTheDocument();
    expect(screen.getByText(/Dinner/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /6:00 PM/i }));
    expect(onSelect).toHaveBeenCalledWith('18:00');
  });

  it('marks the active slot with aria-pressed', () => {
    render(
      <TimeSlotGrid
        value="18:00"
        onSelect={vi.fn()}
        slots={[
          buildSlot({ value: '18:00' as ReservationTime, display: '6:00 PM' }),
          buildSlot({ value: '18:15' as ReservationTime, display: '6:15 PM' }),
        ]}
      />,
    );

    expect(screen.getByRole('button', { name: /6:00 PM/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: /6:15 PM/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('disables slots that are unavailable', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();

    render(
      <TimeSlotGrid
        value=""
        onSelect={onSelect}
        slots={[
          buildSlot({
            value: '22:00' as ReservationTime,
            display: '10:00 PM',
            disabled: true,
          }),
        ]}
      />,
    );

    const button = screen.getByRole('button', { name: /10:00 PM/i });
    expect(button).toBeDisabled();

    await user.click(button);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
