import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchReservationSchedule } from '@features/reservations/wizard/services/schedule';
import { useTimeSlots } from '@features/reservations/wizard/services/useTimeSlots';

import type {
  ReservationSchedule,
  RawScheduleSlot,
} from '@features/reservations/wizard/services/timeSlots';

vi.mock('@features/reservations/wizard/services/schedule', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('@features/reservations/wizard/services/schedule')>();
  return {
    ...original,
    fetchReservationSchedule: vi.fn(),
  };
});

const fetchScheduleMock = vi.mocked(fetchReservationSchedule);

function makeSlot(overrides: Partial<RawScheduleSlot> = {}): RawScheduleSlot {
  return {
    value: '12:00',
    display: '12:00',
    periodId: 'lunch-period',
    periodName: 'Lunch service',
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

function makeSchedule(overrides: Partial<ReservationSchedule> = {}): ReservationSchedule {
  return {
    restaurantId: 'rest-1',
    evaluatedPartySize: 1,
    date: '2026-04-14',
    timezone: 'Europe/London',
    notes: null,
    intervalMinutes: 30,
    defaultDurationMinutes: 90,
    lastSeatingBufferMinutes: 0,
    window: { opensAt: '12:00', closesAt: '22:00' },
    isClosed: false,
    availableBookingOptions: ['lunch', 'dinner'],
    slots: [
      makeSlot(),
      makeSlot({
        value: '19:00',
        display: '19:00',
        periodId: 'dinner-period',
        periodName: '',
        bookingOption: 'dinner',
        defaultBookingOption: 'dinner',
      }),
    ],
    occasionCatalog: [],
    ...overrides,
  };
}

function renderTimeSlots(options: Parameters<typeof useTimeSlots>[0]) {
  const queryClient = createTestQueryClient();
  const wrapper = createQueryWrapper(queryClient);
  return renderHook(() => useTimeSlots(options), { wrapper });
}

beforeEach(() => {
  fetchScheduleMock.mockReset();
});

describe('useTimeSlots', () => {
  it('fetches the schedule and maps slots to descriptors @contract @smoke', async () => {
    fetchScheduleMock.mockResolvedValue(makeSchedule({ evaluatedPartySize: 4 }));

    const { result } = renderTimeSlots({
      restaurantSlug: 'the-fox',
      date: '2026-04-14',
      partySize: 4,
      selectedTime: '19:00',
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(fetchScheduleMock).toHaveBeenCalledWith(
      'the-fox',
      '2026-04-14',
      expect.objectContaining({
        partySize: 4,
        signal: expect.anything(),
      }),
    );
    expect(result.current.slots).toHaveLength(2);
    // Named periods keep their label; blank period names fall back to the
    // title-cased booking option.
    expect(result.current.slots[0]?.label).toBe('Lunch service');
    expect(result.current.slots[1]?.label).toBe('Dinner');
    expect(result.current.availableBookingOptions).toEqual(['lunch', 'dinner']);
    expect(result.current.schedule?.restaurantId).toBe('rest-1');
  });

  it('refetches and replaces slots when party size changes', async () => {
    fetchScheduleMock.mockImplementation(async (_slug, _date, options) => {
      const partySize = options?.partySize ?? 1;
      return makeSchedule({
        evaluatedPartySize: partySize,
        slots:
          partySize === 2
            ? [
                makeSlot({ value: '20:30', display: '20:30' }),
                makeSlot({ value: '21:00', display: '21:00' }),
              ]
            : [makeSlot({ value: '20:30', display: '20:30' })],
      });
    });
    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);
    const { result, rerender } = renderHook(
      ({ partySize }) =>
        useTimeSlots({
          restaurantSlug: 'the-fox',
          date: '2026-04-14',
          partySize,
          selectedTime: null,
        }),
      { initialProps: { partySize: 2 }, wrapper },
    );
    await waitFor(() => expect(result.current.slots.map((slot) => slot.value)).toContain('21:00'));

    rerender({ partySize: 4 });

    await waitFor(() => expect(result.current.slots.map((slot) => slot.value)).toEqual(['20:30']));
    expect(fetchScheduleMock).toHaveBeenCalledTimes(2);
  });

  it('does not expose slots from an untagged or different-party response', async () => {
    fetchScheduleMock
      .mockResolvedValueOnce(makeSchedule({ evaluatedPartySize: undefined }))
      .mockResolvedValueOnce(makeSchedule({ evaluatedPartySize: 2 }));

    const untagged = renderTimeSlots({
      restaurantSlug: 'the-fox',
      date: '2026-04-14',
      partySize: 4,
      selectedTime: null,
    });
    await waitFor(() => expect(untagged.result.current.isFetching).toBe(false));

    const wrongParty = renderTimeSlots({
      restaurantSlug: 'the-fox',
      date: '2026-04-14',
      partySize: 4,
      selectedTime: null,
    });
    await waitFor(() => expect(wrongParty.result.current.isFetching).toBe(false));

    expect(untagged.result.current.slots).toEqual([]);
    expect(wrongParty.result.current.slots).toEqual([]);
  });

  it('stays idle without a restaurant slug or date @contract', () => {
    const missingSlug = renderTimeSlots({
      restaurantSlug: '   ',
      date: '2026-04-14',
      selectedTime: null,
    });
    const missingDate = renderTimeSlots({
      restaurantSlug: 'the-fox',
      date: null,
      selectedTime: null,
    });

    expect(fetchScheduleMock).not.toHaveBeenCalled();
    expect(missingSlug.result.current.slots).toEqual([]);
    expect(missingDate.result.current.slots).toEqual([]);
    expect(missingSlug.result.current.schedule).toBeNull();
  });

  it('infers the booking option from the selected slot @contract', async () => {
    fetchScheduleMock.mockResolvedValue(makeSchedule());

    const { result } = renderTimeSlots({
      restaurantSlug: 'the-fox',
      date: '2026-04-14',
      selectedTime: '19:00',
    });
    await waitFor(() => expect(result.current.slots).toHaveLength(2));

    expect(result.current.inferBookingOption('19:00')).toBe('dinner');
    expect(result.current.inferBookingOption('19:00:00')).toBe('dinner');
    expect(result.current.inferBookingOption('12:00')).toBe('lunch');
  });

  it('falls back to the active slot default for unknown times @contract', async () => {
    fetchScheduleMock.mockResolvedValue(makeSchedule());

    const { result } = renderTimeSlots({
      restaurantSlug: 'the-fox',
      date: '2026-04-14',
      selectedTime: '19:00',
    });
    await waitFor(() => expect(result.current.slots).toHaveLength(2));

    // 21:30 is not a listed slot; the active (19:00 dinner) slot wins.
    expect(result.current.inferBookingOption('21:30')).toBe('dinner');
    expect(result.current.inferBookingOption(null)).toBe('dinner');
  });

  it('reports service availability for the active slot @contract', async () => {
    fetchScheduleMock.mockResolvedValue(makeSchedule());

    const { result } = renderTimeSlots({
      restaurantSlug: 'the-fox',
      date: '2026-04-14',
      selectedTime: '12:00',
    });
    await waitFor(() => expect(result.current.slots).toHaveLength(2));

    expect(result.current.serviceAvailability.services).toEqual({ lunch: 'enabled' });
    expect(result.current.serviceAvailability.labels.lunchWindow).toBe(true);
  });

  it('surfaces fetch failures through isError @contract', async () => {
    fetchScheduleMock.mockRejectedValue(new Error('offline'));

    const { result } = renderTimeSlots({
      restaurantSlug: 'the-fox',
      date: '2026-04-14',
      selectedTime: null,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.slots).toEqual([]);
    expect(result.current.serviceAvailability.services).toEqual({});
  });
});
