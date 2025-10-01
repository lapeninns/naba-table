import { describe, expect, it } from 'vitest';

import { getServiceWindows, getSlotsByService, inferBookingOption } from '@reserve/shared/time';

describe('reservation time helpers', () => {
  it('computes service windows based on weekday/weekend rules', () => {
    const weekday = getServiceWindows('2025-05-07');
    const weekend = getServiceWindows('2025-05-10');

    expect(weekday.happyHour).not.toBeNull();
    expect(weekend.happyHour).toBeNull();
    expect(weekday.lunch.end).toBe('15:00');
    expect(weekend.lunch.end).toBe('17:00');
  });

  it('builds slots per service using reservation interval', () => {
    const slots = getSlotsByService('2025-05-07');
    expect(slots.lunch.length).toBeGreaterThan(0);
    expect(slots.lunch[0]).toBe('12:00');
    expect(slots.dinner[slots.dinner.length - 1]).toBe('22:30');
  });

  it('infers booking option based on time and date', () => {
    expect(inferBookingOption('13:00', '2025-05-07')).toBe('lunch');
    expect(inferBookingOption('18:30', '2025-05-07')).toBe('dinner');
    expect(inferBookingOption('15:30', '2025-05-07')).toBe('drinks');
  });
});
