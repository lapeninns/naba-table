import { describe, expect, it } from 'vitest';

import { BookingValidationService } from '@/server/booking/BookingValidationService';

import type {
  BookingInput,
  CapacityService,
  ScheduleRepository,
  ValidationContext,
} from '@/server/booking/types';
import type { RestaurantSchedule } from '@/server/restaurants/schedule';

const validationContext: ValidationContext = {
  actorId: 'research-verification',
  actorRoles: ['guest'],
  actorCapabilities: [],
  tz: 'Europe/London',
  flags: {
    bookingPastTimeBlocking: true,
    bookingPastTimeGraceMinutes: 5,
    unified: true,
  },
};

const baseInput: BookingInput = {
  restaurantId: 'restaurant-1',
  serviceId: 'dinner',
  partySize: 4,
  start: '2030-07-01T21:00:00',
  durationMinutes: 90,
  bookingType: 'dinner',
  seatingPreference: 'any',
  source: 'web',
};

function buildSchedule(params: {
  readonly date: string;
  readonly opensAt: string;
  readonly closesAt: string;
  readonly slot: string;
}): RestaurantSchedule {
  return {
    restaurantId: 'restaurant-1',
    date: params.date,
    timezone: 'Europe/London',
    notes: null,
    intervalMinutes: 30,
    defaultDurationMinutes: 90,
    lastSeatingBufferMinutes: 15,
    window: {
      opensAt: params.opensAt,
      closesAt: params.closesAt,
    },
    isClosed: false,
    availableBookingOptions: ['dinner'],
    slots: [
      {
        value: params.slot,
        display: params.slot,
        periodId: 'dinner-period',
        periodName: 'Dinner',
        bookingOption: 'dinner',
        defaultBookingOption: 'dinner',
        availability: {
          services: { dinner: 'enabled' },
          labels: {
            kitchenClosed: false,
            lunchWindow: false,
            dinnerWindow: true,
          },
        },
        disabled: false,
      },
    ],
    occasionCatalog: [],
  };
}

function buildService(schedule: RestaurantSchedule): {
  readonly service: BookingValidationService;
  readonly capacityChecks: () => number;
} {
  let checkCount = 0;
  const scheduleRepository: ScheduleRepository = {
    getSchedule: async () => schedule,
  };
  const capacityService: CapacityService = {
    checkAvailability: async () => {
      checkCount += 1;
      return { ok: true };
    },
    createBooking: async () => ({ success: false }),
    updateBooking: async () => ({ success: false }),
  };

  return {
    service: new BookingValidationService(scheduleRepository, capacityService, {
      timeProvider: { now: () => new Date('2026-07-16T12:00:00.000Z') },
      logger: {
        debug: () => undefined,
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
      },
    }),
    capacityChecks: () => checkCount,
  };
}

describe('booking-window research verification', () => {
  it('rejects a listed same-day slot when its resolved duration ends after close', async () => {
    const { service, capacityChecks } = buildService(
      buildSchedule({
        date: '2030-07-01',
        opensAt: '17:00',
        closesAt: '22:00',
        slot: '21:00',
      }),
    );

    const result = await service.validateCreate(baseInput, validationContext);

    expect(result.response.ok).toBe(false);
    expect(result.response.issues.map((issue) => issue.code)).toContain('OUTSIDE_HOURS');
    expect(capacityChecks()).toBe(0);
  });

  it('rejects a listed pre-midnight overnight slot at the start-only gate', async () => {
    const { service, capacityChecks } = buildService(
      buildSchedule({
        date: '2030-07-01',
        opensAt: '17:00',
        closesAt: '00:00',
        slot: '23:00',
      }),
    );

    const result = await service.validateCreate(
      {
        ...baseInput,
        start: '2030-07-01T23:00:00',
        durationMinutes: 60,
      },
      validationContext,
    );

    expect(result.response.ok).toBe(false);
    expect(result.response.issues.map((issue) => issue.code)).toEqual(['OUTSIDE_HOURS']);
    expect(capacityChecks()).toBe(0);
  });
});
