import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { State } from '@features/reservations/wizard/model/reducer';
import type { WizardActions } from '@features/reservations/wizard/model/store';
import type { CalendarMask } from '@features/reservations/wizard/services/schedule';
import type {
  RawScheduleSlot,
  ReservationSchedule,
} from '@features/reservations/wizard/services/timeSlots';
import type * as ScheduleService from '@reserve/features/reservations/wizard/services/schedule';

vi.mock('@/lib/analytics/emit', () => ({ emit: vi.fn() }));

vi.mock('@reserve/features/reservations/wizard/services/schedule', async (importOriginal) => {
  const actual = await importOriginal<typeof ScheduleService>();
  return {
    ...actual,
    fetchReservationSchedule: vi.fn(),
    fetchCalendarMask: vi.fn(),
  };
});

const buildSlot = (value: string): RawScheduleSlot => ({
  value,
  display: value,
  periodId: 'dinner',
  periodName: 'Dinner',
  bookingOption: 'dinner',
  defaultBookingOption: 'dinner',
  availability: {
    services: { lunch: 'disabled', dinner: 'enabled' },
    labels: { kitchenClosed: false, lunchWindow: false, dinnerWindow: true },
  },
  disabled: false,
});

const buildSchedule = (date: string): ReservationSchedule => ({
  restaurantId: 'rest-1',
  date,
  timezone: 'Europe/London',
  notes: null,
  intervalMinutes: 30,
  defaultDurationMinutes: 90,
  lastSeatingBufferMinutes: 0,
  window: { opensAt: '17:00', closesAt: '22:00' },
  isClosed: false,
  availableBookingOptions: ['dinner'],
  slots: [buildSlot('17:00'), buildSlot('18:00'), buildSlot('19:00')],
  occasionCatalog: [],
});

const buildActions = (): WizardActions => ({
  goToStep: vi.fn(),
  updateDetails: vi.fn(),
  setSubmitting: vi.fn(),
  setLoading: vi.fn(),
  setError: vi.fn(),
  setSubmissionError: vi.fn(),
  clearError: vi.fn(),
  setBookings: vi.fn(),
  applyConfirmation: vi.fn(),
  startEdit: vi.fn(),
  resetForm: vi.fn(),
  hydrateContacts: vi.fn(),
  hydrateDetails: vi.fn(),
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('usePlanStepForm current-day availability recovery', () => {
  it('auto-advances when the current date only has past slots left @contract', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-07-07T21:30:00+01:00'));

    const queryClient = createTestQueryClient();
    const QueryWrapper = createQueryWrapper(queryClient);
    const { getInitialState } = await import('@features/reservations/wizard/model/reducer');
    const { usePlanStepForm } = await import('@features/reservations/wizard/hooks/usePlanStepForm');
    const { fetchReservationSchedule, fetchCalendarMask } =
      await import('@reserve/features/reservations/wizard/services/schedule');

    const mask: CalendarMask = {
      timezone: 'Europe/London',
      from: '2026-07-01',
      to: '2026-07-31',
      closedDaysOfWeek: [],
      closedDates: [],
    };
    vi.mocked(fetchCalendarMask).mockResolvedValue(mask);
    vi.mocked(fetchReservationSchedule).mockResolvedValue(buildSchedule('2026-07-07'));

    const state: State = getInitialState({
      restaurantId: 'rest-1',
      restaurantSlug: 'the-old-crown-girton',
      restaurantName: 'The Old Crown Girton',
      restaurantTimezone: 'Europe/London',
      date: '2026-07-07',
      time: '',
      party: 2,
      bookingType: 'dinner',
    });
    const actions = buildActions();

    renderHook(
      () =>
        usePlanStepForm({
          state,
          actions,
          minDate: new Date('2026-07-07T00:00:00+01:00'),
          initialCalendarMask: mask,
          onActionsChange: vi.fn(),
        }),
      { wrapper: QueryWrapper },
    );

    await waitFor(() => {
      expect(actions.updateDetails).toHaveBeenCalledWith('date', '2026-07-08');
    });
  });
});
