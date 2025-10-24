import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ScheduleAwareTimestampPicker } from '@/components/features/booking-state-machine/ScheduleAwareTimestampPicker';

import type { ScheduleAwareTimestampPickerProps } from '@/components/features/booking-state-machine/ScheduleAwareTimestampPicker';
import type * as ScheduleServiceModule from '@reserve/features/reservations/wizard/services/schedule';
import type { ReservationSchedule } from '@reserve/features/reservations/wizard/services/timeSlots';
import type * as AvailabilityModule from '@reserve/shared/schedule/availability';

const fetchScheduleMock = vi.hoisted(() => vi.fn());

vi.mock('@reserve/features/reservations/wizard/services/schedule', async () => {
  const actual = await vi.importActual<ScheduleServiceModule>(
    '@reserve/features/reservations/wizard/services/schedule',
  );
  return {
    ...actual,
    fetchReservationSchedule: fetchScheduleMock,
  };
});

vi.mock('@reserve/shared/schedule/availability', async () => {
  const actual = await vi.importActual<AvailabilityModule>('@reserve/shared/schedule/availability');
  return {
    ...actual,
    isDateUnavailable: () => null,
  };
});

const slotAvailability = {
  services: { dinner: 'enabled' as const },
  labels: {
    happyHour: false,
    drinksOnly: false,
    kitchenClosed: false,
    lunchWindow: false,
    dinnerWindow: true,
  },
};

const buildSchedule = (date: string): ReservationSchedule => ({
  restaurantId: 'rest-1',
  date,
  timezone: 'Europe/London',
  intervalMinutes: 30,
  defaultDurationMinutes: 90,
  lastSeatingBufferMinutes: 30,
  window: {
    opensAt: '17:00',
    closesAt: '23:00',
  },
  isClosed: false,
  availableBookingOptions: ['dinner'],
  slots: [
    {
      value: '18:00',
      display: '6:00 PM',
      periodId: 'evening',
      periodName: 'Dinner',
      bookingOption: 'dinner',
      defaultBookingOption: 'dinner',
      availability: slotAvailability,
      disabled: false,
    },
    {
      value: '18:30',
      display: '6:30 PM',
      periodId: 'evening',
      periodName: 'Dinner',
      bookingOption: 'dinner',
      defaultBookingOption: 'dinner',
      availability: slotAvailability,
      disabled: false,
    },
  ],
  occasionCatalog: [],
});

function renderPicker(props: Partial<ScheduleAwareTimestampPickerProps> = {}) {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const defaultProps: ScheduleAwareTimestampPickerProps = {
    restaurantSlug: 'demo-restaurant',
    restaurantTimezone: 'Europe/London',
    value: '2025-01-15T18:00:00.000Z',
    onChange: vi.fn(),
    label: 'Start time',
    minDate: new Date('2025-01-15T00:00:00.000Z'),
  };

  const result = render(
    <QueryClientProvider client={client}>
      <ScheduleAwareTimestampPicker {...defaultProps} {...props} />
    </QueryClientProvider>,
  );

  const onChange = (props.onChange ??
    defaultProps.onChange) as ScheduleAwareTimestampPickerProps['onChange'];

  return {
    ...result,
    queryClient: client,
    onChange,
  };
}

describe('<ScheduleAwareTimestampPicker /> manual entry', () => {
  beforeEach(() => {
    fetchScheduleMock.mockReset();
    fetchScheduleMock.mockImplementation(async (_slug: string, dateKey: string) =>
      buildSchedule(dateKey),
    );
  });

  it('rejects manual times that are not available and surfaces an inline error', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    renderPicker({ onChange: handleChange });

    await waitFor(() => expect(fetchScheduleMock).toHaveBeenCalled());

    const timeInput = await screen.findByLabelText('Time');
    await waitFor(() => expect((timeInput as HTMLInputElement).value).toBe('18:00'));
    handleChange.mockClear();

    await user.clear(timeInput);
    await user.type(timeInput, '21:45');
    await user.tab();

    expect(handleChange).not.toHaveBeenCalled();
    expect(
      screen.getByText('Selected time is no longer available. Please choose another slot.'),
    ).toBeInTheDocument();
    expect((timeInput as HTMLInputElement).value).toBe('18:00');
  });

  it('clears the error once a valid slot is chosen', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    renderPicker({ onChange: handleChange });

    await waitFor(() => expect(fetchScheduleMock).toHaveBeenCalled());

    const timeInput = await screen.findByLabelText('Time');
    await waitFor(() => expect((timeInput as HTMLInputElement).value).toBe('18:00'));
    handleChange.mockClear();

    await user.clear(timeInput);
    await user.type(timeInput, '21:45');
    await user.tab();

    expect(
      screen.getByText('Selected time is no longer available. Please choose another slot.'),
    ).toBeInTheDocument();
    expect(handleChange).not.toHaveBeenCalled();

    await user.click(await screen.findByRole('button', { name: '6:30 PM, Dinner' }));

    await waitFor(() => expect(handleChange).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(
        screen.queryByText('Selected time is no longer available. Please choose another slot.'),
      ).not.toBeInTheDocument(),
    );
  });
});
