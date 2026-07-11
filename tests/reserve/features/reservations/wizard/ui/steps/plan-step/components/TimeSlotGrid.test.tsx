import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { TimeSlotGrid } from '@features/reservations/wizard/ui/steps/plan-step/components/TimeSlotGrid';

import type { TimeSlotDescriptor } from '@features/reservations/wizard/services';

function makeSlot(overrides: Partial<TimeSlotDescriptor> = {}): TimeSlotDescriptor {
  return {
    value: '12:00',
    display: '12:00',
    label: 'Lunch',
    bookingOption: 'lunch',
    defaultBookingOption: 'lunch',
    availability: {
      services: { lunch: 'enabled' },
      labels: { kitchenClosed: false, lunchWindow: true, dinnerWindow: false },
    },
    disabled: false,
    ...overrides,
  };
}

const slots = [
  makeSlot(),
  makeSlot({ value: '12:30', display: '12:30' }),
  makeSlot({ value: '19:00', display: '19:00', label: 'Dinner', bookingOption: 'dinner' }),
  makeSlot({ value: '19:30', display: '19:30', label: 'Dinner', bookingOption: 'dinner', disabled: true }),
];

describe('TimeSlotGrid', () => {
  it('groups slots by service label and counts the options @contract @smoke', () => {
    render(<TimeSlotGrid slots={slots} value="12:00" onSelect={vi.fn()} />);

    expect(screen.getByRole('region', { name: 'Available times' })).toBeInTheDocument();
    expect(screen.getByText('Lunch')).toBeInTheDocument();
    expect(screen.getByText('Dinner')).toBeInTheDocument();
    expect(screen.getByText('4 options')).toBeInTheDocument();
  });

  it('marks the active slot and selects new ones @contract', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<TimeSlotGrid slots={slots} value="12:00" onSelect={onSelect} />);

    expect(screen.getByRole('radio', { name: '12:00, Lunch' })).toHaveAttribute('data-state', 'on');

    await user.click(screen.getByRole('radio', { name: '19:00, Dinner' }));
    expect(onSelect).toHaveBeenCalledWith('19:00');
  });

  it('ignores clicks on disabled slots @contract', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<TimeSlotGrid slots={slots} value="12:00" onSelect={onSelect} />);

    const disabledSlot = screen.getByRole('radio', { name: '19:30, Dinner' });
    expect(disabledSlot).toBeDisabled();
    await user.click(disabledSlot);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('renders nothing when there are no slots and not loading @contract', () => {
    const { container } = render(<TimeSlotGrid slots={[]} value="" onSelect={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows a skeleton grid while loading an empty schedule @contract', () => {
    const { container } = render(<TimeSlotGrid slots={[]} value="" onSelect={vi.fn()} loading />);
    expect(container.firstChild).not.toBeNull();
    expect(screen.queryByRole('region', { name: 'Available times' })).not.toBeInTheDocument();
  });

  it('uses the singular option label for one slot @contract', () => {
    render(<TimeSlotGrid slots={[makeSlot()]} value="" onSelect={vi.fn()} />);
    expect(screen.getByText('1 option')).toBeInTheDocument();
  });
});
