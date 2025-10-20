import { describe, expect, it } from 'vitest';

import {
  EMPTY_AVAILABILITY,
  toTimeSlotDescriptor,
  type ServiceAvailability,
} from '@reserve/features/reservations/wizard/services';

const baseAvailability: ServiceAvailability = {
  services: {
    lunch: 'disabled',
    dinner: 'disabled',
    drinks: 'enabled',
  },
  labels: {
    happyHour: false,
    drinksOnly: true,
    kitchenClosed: true,
    lunchWindow: false,
    dinnerWindow: false,
  },
};

describe('time slot helpers', () => {
  it('uses provided period name when mapping descriptors', () => {
    const descriptor = toTimeSlotDescriptor({
      value: '17:00',
      display: '17:00',
      periodId: 'sp-1',
      periodName: 'Chef tasting',
      bookingOption: 'dinner',
      defaultBookingOption: 'dinner',
      availability: baseAvailability,
      disabled: false,
    });

    expect(descriptor.label).toBe('Chef tasting');
    expect(descriptor.periodId).toBe('sp-1');
    expect(descriptor.bookingOption).toBe('dinner');
  });

  it('falls back to default booking labels when name missing', () => {
    const descriptor = toTimeSlotDescriptor({
      value: '21:00',
      display: '21:00',
      periodId: null,
      periodName: null,
      bookingOption: 'drinks',
      defaultBookingOption: 'drinks',
      availability: baseAvailability,
      disabled: false,
    });

    expect(descriptor.label).toBe('Drinks');
    expect(descriptor.bookingOption).toBe('drinks');
  });

  it('exposes an immutable empty availability template', () => {
    expect(EMPTY_AVAILABILITY.services.lunch).toBeUndefined();
    expect(EMPTY_AVAILABILITY.labels.happyHour).toBe(false);
  });
});
