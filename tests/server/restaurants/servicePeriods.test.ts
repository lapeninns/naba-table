import { assertNoOverlappingPeriods, type ServicePeriod } from '@/server/restaurants/servicePeriods';

let counter = 0;
function createPeriod(overrides: Partial<ServicePeriod> = {}): ServicePeriod {
  counter += 1;
  return {
    id: `period-${counter}`,
    name: 'Lunch',
    dayOfWeek: null,
    startTime: '10:00',
    endTime: '12:00',
    bookingOption: 'lunch',
    ...overrides,
  };
}

describe('assertNoOverlappingPeriods', () => {
  beforeEach(() => {
    counter = 0;
  });

  it('throws when non-Drinks periods overlap', () => {
    const overlapping = [
      createPeriod({ name: 'Lunch', startTime: '10:00', endTime: '13:00' }),
      createPeriod({ name: 'Dinner', startTime: '12:00', endTime: '15:00' }),
    ];

    expect(() => assertNoOverlappingPeriods(overlapping)).toThrowError(/Service periods overlap/);
  });

  it('allows Drinks overlapping other periods', () => {
    const periods = [
      createPeriod({ name: 'Drinks', startTime: '09:00', endTime: '23:00', bookingOption: 'drinks' }),
      createPeriod({ name: 'Lunch', startTime: '11:00', endTime: '15:00' }),
    ];

    expect(() => assertNoOverlappingPeriods(periods)).not.toThrow();
  });

  it('allows multiple Drinks overlaps', () => {
    const periods = [
      createPeriod({ name: 'Drinks', startTime: '09:00', endTime: '14:00', bookingOption: 'drinks-morning' }),
      createPeriod({ name: 'DRINKS', startTime: '13:00', endTime: '23:00', bookingOption: 'drinks-evening' }),
    ];

    expect(() => assertNoOverlappingPeriods(periods)).not.toThrow();
  });

  it('treats Drinks name case-insensitively and trimmed', () => {
    const periods = [
      createPeriod({ name: '  drinks  ', startTime: '09:00', endTime: '22:00' }),
      createPeriod({ name: 'Dinner', startTime: '18:00', endTime: '23:00' }),
    ];

    expect(() => assertNoOverlappingPeriods(periods)).not.toThrow();
  });

  it('still blocks overlapping food periods even when Drinks spans the day', () => {
    const periods = [
      createPeriod({ name: 'Drinks', startTime: '09:00', endTime: '23:00', bookingOption: 'drinks' }),
      createPeriod({ name: 'Lunch', startTime: '10:00', endTime: '13:30' }),
      createPeriod({ name: 'Dinner', startTime: '13:00', endTime: '17:00' }),
    ];

    expect(() => assertNoOverlappingPeriods(periods)).toThrowError(/Lunch" and "Dinner/);
  });
});
