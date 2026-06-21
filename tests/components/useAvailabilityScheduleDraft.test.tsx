import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useAvailabilityScheduleDraft } from '@/components/features/restaurant-settings/useAvailabilityScheduleDraft';

import type { AvailabilityScheduleDraftState } from '@/components/features/restaurant-settings/availabilityScheduleManagerDomain';
import type { WeeklyRow } from '@/components/features/restaurant-settings/types';

function makeWeeklyRow(dayOfWeek: number): WeeklyRow {
  return {
    dayOfWeek,
    opensAt: '12:00',
    closesAt: '22:00',
    isClosed: false,
    notes: '',
    reservationIntervalMinutes: '15',
    reservationSlotTimes: '',
  };
}

function makeDraftState(): AvailabilityScheduleDraftState {
  return {
    customRows: [],
    dayConfigs: [0, 1].map((dayOfWeek) => ({
      dayOfWeek,
      label: dayOfWeek === 0 ? 'Sunday' : 'Monday',
      opensAt: '12:00',
      closesAt: '22:00',
      isClosed: false,
      lunch: {
        enabled: true,
        endTime: '15:00',
        name: 'Lunch',
        startTime: '12:00',
      },
      dinner: {
        enabled: true,
        endTime: '22:00',
        name: 'Dinner',
        startTime: '17:00',
      },
    })),
    occasionDrafts: [],
    overrideRows: [],
    turnBandsDraft: {},
    weeklyRows: [makeWeeklyRow(0), makeWeeklyRow(1)],
  };
}

describe('useAvailabilityScheduleDraft', () => {
  it('initializes draft state and marks weekly edits dirty', () => {
    const onDraftChanged = vi.fn();
    const { result } = renderHook(() => useAvailabilityScheduleDraft({ onDraftChanged }));

    act(() => result.current.initializeDraftState(makeDraftState()));

    expect(result.current.hasInitialized).toBe(true);
    expect(result.current.hasLocalChanges).toBe(false);

    act(() => result.current.handleWeeklyChange(1, { isClosed: true }));

    expect(result.current.hoursDirty).toBe(true);
    expect(result.current.hasLocalChanges).toBe(true);
    expect(result.current.weeklyRows[1]?.isClosed).toBe(true);
    expect(result.current.dayConfigs[1]?.isClosed).toBe(true);
    expect(result.current.dayConfigs[1]?.lunch.enabled).toBe(false);
    expect(result.current.dayConfigs[1]?.dinner.enabled).toBe(false);
    expect(onDraftChanged).toHaveBeenCalledTimes(1);
  });

  it('stores validation errors and clears relevant service errors on meal edits', () => {
    const onDraftChanged = vi.fn();
    const { result } = renderHook(() => useAvailabilityScheduleDraft({ onDraftChanged }));

    act(() => result.current.initializeDraftState(makeDraftState()));
    act(() =>
      result.current.applyValidationResult({
        isValid: false,
        overrideErrors: [],
        serviceErrors: { 1: { lunch: { start: 'Starts before opening' } } },
        turnBandErrors: {},
        weeklyErrors: { 1: { opensAt: 'Required' } },
      }),
    );

    expect(result.current.serviceErrors[1]?.lunch?.start).toBe('Starts before opening');
    expect(result.current.weeklyErrors[1]?.opensAt).toBe('Required');

    act(() => result.current.handleMealTimeChange(1, 'lunch', 'startTime', '12:30'));

    expect(result.current.servicesDirty).toBe(true);
    expect(result.current.serviceErrors[1]?.lunch).toBeUndefined();
    expect(result.current.weeklyErrors[1]?.opensAt).toBe('Required');
    expect(onDraftChanged).toHaveBeenCalledTimes(1);
  });
});
