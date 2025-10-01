import { describe, expect, it } from 'vitest';

import {
  buildTimeSlots,
  getServiceAvailability,
  resolveDefaultBookingOption,
} from '@reserve/features/reservations/wizard/services';
import { normalizeTime } from '@reserve/shared/time';

describe('wizard time slot service', () => {
  it('builds deterministic slots for a given date', () => {
    const slots = buildTimeSlots({ date: '2025-05-08' });
    expect(slots).toHaveLength(22);
    expect(slots[0]?.value).toBe('12:00');
    expect(slots.at(-1)?.value).toBe('22:30');
    expect(slots[0]?.label).toBe('Lunch');
  });

  it('marks happy hour slots as drinks only on weekdays', () => {
    const availability = getServiceAvailability('2025-05-08', '16:00');
    expect(availability.labels.happyHour).toBe(true);
    expect(resolveDefaultBookingOption('2025-05-08', '16:00')).toBe('drinks');
  });

  it('supports weekend windows extending lunch to 17:00', () => {
    const slots = buildTimeSlots({ date: '2025-05-10' });
    const sixteenThirty = normalizeTime('16:30');
    expect(sixteenThirty).not.toBeNull();
    const slot = slots.find((entry) => entry.value === sixteenThirty);
    expect(slot?.label).toBe('Lunch');
    expect(slot?.availability.services.lunch).toBe('enabled');
    expect(slot?.availability.services.dinner).toBe('disabled');
  });

  it('does not drop slots across DST transition days', () => {
    const springForward = buildTimeSlots({ date: '2025-03-30' });
    const fallBack = buildTimeSlots({ date: '2025-10-26' });

    expect(springForward).toHaveLength(22);
    expect(fallBack).toHaveLength(22);
  });
});
