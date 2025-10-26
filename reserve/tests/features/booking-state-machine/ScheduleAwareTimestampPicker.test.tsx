import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ScheduleAwareTimestampPicker } from '@/components/features/booking-state-machine/ScheduleAwareTimestampPicker';

import type { ScheduleAwareTimestampPickerProps } from '@/components/features/booking-state-machine/ScheduleAwareTimestampPicker';
import type * as ScheduleServiceModule from '@reserve/features/reservations/wizard/services/schedule';
import type { ReservationSchedule } from '@reserve/features/reservations/wizard/services/timeSlots';
import type * as AvailabilityModule from '@reserve/shared/schedule/availability';

const fetchScheduleMock = vi.hoisted(() => vi.fn());
const scrollIntoViewMock = vi.hoisted(() => vi.fn());

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
    minDate: new Date('2025-01-01T00:00:00.000Z'),
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
    scrollIntoViewMock.mockReset();
  });

  beforeAll(() => {
    Element.prototype.scrollIntoView = scrollIntoViewMock;
  });

  it('prefills the saved date and time on initial render', async () => {
    renderPicker();

    await waitFor(() => expect(fetchScheduleMock).toHaveBeenCalled());
    const requestedDates = fetchScheduleMock.mock.calls.map(([, date]) => date);
    expect(requestedDates).toContain('2025-01-15');

    const dateLabel = await screen.findByText(/15 January 2025/i);
    expect(dateLabel).toBeInTheDocument();

    const timeInput = await screen.findByLabelText('Time');
    await waitFor(() => expect((timeInput as HTMLInputElement).value).toBe('18:00'));
    expect(scrollIntoViewMock).toHaveBeenCalled();
    expect(
      screen.queryByText('We couldn’t load availability right now. Please try again or choose another date.'),
    ).not.toBeInTheDocument();
  });

  it('enables the time field once availability resolves', async () => {
    renderPicker();

    const timeInput = await screen.findByLabelText('Time');
    await waitFor(() => expect(timeInput).not.toBeDisabled());
  });

  it('keeps the stored time and surfaces a warning when the slot disappears', async () => {
    fetchScheduleMock.mockImplementation(async (_slug: string, dateKey: string) => {
      const schedule = buildSchedule(dateKey);
      return {
        ...schedule,
        slots: [
          {
            value: '19:00',
            display: '7:00 PM',
            periodId: 'evening',
            periodName: 'Dinner',
            bookingOption: 'dinner',
            defaultBookingOption: 'dinner',
            availability: slotAvailability,
            disabled: false,
          },
        ],
      };
    });

    const handleChange = vi.fn();
    renderPicker({ onChange: handleChange });

    const timeInput = await screen.findByLabelText('Time');
    await waitFor(() => expect(fetchScheduleMock).toHaveBeenCalled());
    await waitFor(() =>
      expect(
        screen.getByText('Selected time is no longer available. Please choose another slot.'),
      ).toBeInTheDocument(),
    );

    expect(handleChange).not.toHaveBeenCalled();
    expect((timeInput as HTMLInputElement).value).toBe('18:00');
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

  it('keeps all time options visible after selecting a different slot on the same date', async () => {
    const user = userEvent.setup();
    const { onChange } = renderPicker();

    await waitFor(() => expect(fetchScheduleMock).toHaveBeenCalled());
    const timeInput = await screen.findByLabelText('Time');
    await waitFor(() => expect((timeInput as HTMLInputElement).value).toBe('18:00'));

    const sixThirtyButton = await screen.findByRole('button', { name: '6:30 PM, Dinner' });
    onChange.mockClear();

    await user.click(sixThirtyButton);

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.stringContaining('18:30')));
    expect(screen.getByRole('button', { name: '6:00 PM, Dinner' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '6:30 PM, Dinner' })).toBeInTheDocument();
    expect(screen.queryByText('No available times for the selected date.')).not.toBeInTheDocument();

    const datalistId = (timeInput as HTMLInputElement).getAttribute('list');
    const datalist = datalistId ? document.getElementById(datalistId) : null;
    expect(datalist?.querySelectorAll('option').length ?? 0).toBeGreaterThan(0);
  });

  it('clears the time and shows loading feedback when the date changes', async () => {
    const user = userEvent.setup();
    let resolveNextDate: (() => void) | null = null;

    fetchScheduleMock.mockImplementation(async (_slug: string, dateKey: string) => {
      if (dateKey === '2025-01-16') {
        return await new Promise<ReservationSchedule>((resolve) => {
          resolveNextDate = () => resolve(buildSchedule(dateKey));
        });
      }
      return buildSchedule(dateKey);
    });

    const { onChange } = renderPicker();

    const timeInput = await screen.findByLabelText('Time');
    await waitFor(() => expect((timeInput as HTMLInputElement).value).toBe('18:00'));
    onChange.mockClear();

    await user.click(screen.getByRole('button', { name: 'Date' }));
    const matchDate = (value: string | null) =>
      Boolean(value && /(?:^|\s)(?:1[\/.\-]16[\/.\-]2025|16[\/.\-]1[\/.\-]2025)(?:\s|$)/.test(value));
    await waitFor(() => {
      const candidates = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-day]'));
      expect(candidates.some((btn) => matchDate(btn.getAttribute('data-day')))).toBe(true);
    });
    const nextDay = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-day]')).find((btn) =>
      matchDate(btn.getAttribute('data-day')),
    );
    expect(nextDay).toBeTruthy();
    await user.click(nextDay!);

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(null));
    await waitFor(() => expect((timeInput as HTMLInputElement).value).toBe(''));
    expect(timeInput).toBeDisabled();
    expect(await screen.findByText('Finding available times…')).toBeInTheDocument();

    expect(resolveNextDate).toBeTruthy();
    act(() => resolveNextDate?.());

    await waitFor(() => expect(timeInput).not.toBeDisabled());
    expect((timeInput as HTMLInputElement).value).toBe('');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('surfaces closed-date messaging in the slot region and blocks selection', async () => {
    const user = userEvent.setup();

    fetchScheduleMock.mockImplementation(async (_slug: string, dateKey: string) => {
      if (dateKey === '2025-01-16') {
        const schedule = buildSchedule(dateKey);
        return {
          ...schedule,
          isClosed: true,
          slots: [],
        } satisfies ReservationSchedule;
      }
      return buildSchedule(dateKey);
    });

    const { onChange } = renderPicker();

    const timeInput = await screen.findByLabelText('Time');
    await waitFor(() => expect((timeInput as HTMLInputElement).value).toBe('18:00'));
    onChange.mockClear();

    await user.click(screen.getByRole('button', { name: 'Date' }));
    const matchClosedDate = (value: string | null) =>
      Boolean(value && /(?:^|\s)(?:1[\/.\-]16[\/.\-]2025|16[\/.\-]1[\/.\-]2025)(?:\s|$)/.test(value));
    await waitFor(() => {
      const candidates = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-day]'));
      expect(candidates.some((btn) => matchClosedDate(btn.getAttribute('data-day')))).toBe(true);
    });
    const closedDate = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-day]')).find((btn) =>
      matchClosedDate(btn.getAttribute('data-day')),
    );
    expect(closedDate).toBeTruthy();
    await user.click(closedDate!);

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(null));
    const closedMessage = await screen.findByText(/We’re closed on this date/i);
    expect(closedMessage).toBeInTheDocument();

    expect(timeInput).toBeDisabled();
    expect((timeInput as HTMLInputElement).value).toBe('');
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
