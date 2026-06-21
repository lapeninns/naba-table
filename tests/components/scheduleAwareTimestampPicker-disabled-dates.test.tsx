import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { UnavailabilityReason } from '@/components/features/booking-state-machine/scheduleAwareTimestampPickerDomain';

// Seed the availability loader with a controlled `unavailableDates` map so the
// picker's `isDateDisabled` closure can be exercised without any network/timing.
const CLOSED_KEY = '2026-07-01';
const NO_SLOTS_KEY = '2026-07-02';
const OPEN_KEY = '2026-07-03';

const unavailableDates = new Map<string, UnavailabilityReason>([
  [CLOSED_KEY, 'closed'],
  [NO_SLOTS_KEY, 'no-slots'],
]);

vi.mock('@/components/features/booking-state-machine/useScheduleAvailabilityLoader', () => ({
  useScheduleAvailabilityLoader: () => ({
    activeRecordStatus: 'success',
    currentSchedule: null,
    getScheduleForDate: () => null,
    handleMonthPrefetch: vi.fn(),
    loadingDates: new Set<string>(),
    resetScheduleAvailability: vi.fn(),
    unavailableDates,
    unavailabilityReason: null,
  }),
}));

// Imported after the mock is registered.
import { useScheduleAwareTimestampPicker } from '@/components/features/booking-state-machine/useScheduleAwareTimestampPicker';

function dateFromKey(key: string): Date {
  const [year, month, day] = key.split('-').map((part) => Number.parseInt(part, 10));
  return new Date(year, month - 1, day);
}

function renderPicker() {
  return renderHook(() =>
    useScheduleAwareTimestampPicker({
      disabled: false,
      onChange: vi.fn(),
      restaurantSlug: 'demo',
      value: `${OPEN_KEY}T19:00`,
    }),
  );
}

describe('useScheduleAwareTimestampPicker isDateDisabled', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-21T09:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('disables fully-closed days', () => {
    const { result } = renderPicker();
    expect(result.current.isDateDisabled(dateFromKey(CLOSED_KEY))).toBe(true);
  });

  it('disables fully-booked (no-slots) days', () => {
    const { result } = renderPicker();
    // Regression for triage-093: no-slots days must be blocked, not just closed days.
    expect(result.current.isDateDisabled(dateFromKey(NO_SLOTS_KEY))).toBe(true);
  });

  it('keeps ordinary available days selectable', () => {
    const { result } = renderPicker();
    expect(result.current.isDateDisabled(dateFromKey(OPEN_KEY))).toBe(false);
  });
});
