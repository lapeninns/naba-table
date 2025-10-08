import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useTimeSlots } from '@reserve/features/reservations/wizard/services';

describe('useTimeSlots hook', () => {
  it('returns memoized slot descriptors and availability', () => {
    const { result, rerender } = renderHook(
      ({ date, selectedTime }) => useTimeSlots({ date, selectedTime }),
      {
        initialProps: { date: '2025-05-08', selectedTime: '12:00' },
      },
    );

    expect(result.current.slots).toHaveLength(44);
    expect(result.current.serviceAvailability.services.lunch).toBe('enabled');

    rerender({ date: '2025-05-08', selectedTime: '16:00' });

    expect(result.current.serviceAvailability.labels.happyHour).toBe(true);
    expect(result.current.inferBookingOption('18:00')).toBe('dinner');
  });

  it('handles missing date gracefully', () => {
    const { result } = renderHook(() => useTimeSlots({ date: '', selectedTime: null }));
    expect(result.current.slots).toHaveLength(0);
    expect(result.current.serviceAvailability.services).toEqual({
      lunch: 'disabled',
      dinner: 'disabled',
      drinks: 'disabled',
    });
  });
});
