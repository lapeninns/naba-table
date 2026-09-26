import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BookingValidationError,
  BookingValidationService,
} from '@/server/booking/BookingValidationService';

import type {
  BookingInput,
  CapacityService,
  ScheduleRepository,
  ValidationContext,
} from '@/server/booking/types';

const schedule = {
  restaurantId: 'restaurant-1',
  date: '2026-07-01',
  timezone: 'Europe/London',
  notes: null,
  intervalMinutes: 15,
  defaultDurationMinutes: 90,
  lastSeatingBufferMinutes: 15,
  window: {
    opensAt: '17:00',
    closesAt: '22:00',
  },
  isClosed: false,
  availableBookingOptions: ['dinner'],
  slots: [
    {
      value: '19:00',
      display: '19:00',
      periodId: 'period-1',
      periodName: 'Dinner',
      bookingOption: 'dinner',
      defaultBookingOption: 'dinner',
      availability: {
        services: { lunch: 'disabled', dinner: 'enabled' },
        labels: { kitchenClosed: false, lunchWindow: false, dinnerWindow: true },
      },
      disabled: false,
    },
    {
      value: '20:00',
      display: '20:00',
      periodId: 'period-1',
      periodName: 'Dinner',
      bookingOption: 'dinner',
      defaultBookingOption: 'dinner',
      availability: {
        services: { lunch: 'disabled', dinner: 'enabled' },
        labels: { kitchenClosed: false, lunchWindow: false, dinnerWindow: true },
      },
      disabled: false,
    },
  ],
  occasionCatalog: [],
} as const;

const baseInput: BookingInput = {
  restaurantId: 'restaurant-1',
  serviceId: 'dinner',
  partySize: 2,
  start: '2026-07-01T19:00:00',
  durationMinutes: 90,
  bookingType: 'dinner',
  seatingPreference: 'any',
  customerId: 'customer-1',
  customerName: 'Alex Guest',
  customerEmail: 'alex@example.com',
  customerPhone: '+447700900123',
  marketingOptIn: false,
  source: 'web',
};

const context: ValidationContext = {
  actorId: 'caller-controlled-request-id',
  actorRoles: ['guest'],
  actorCapabilities: [],
  tz: 'Europe/London',
  flags: {
    bookingPastTimeBlocking: true,
    bookingPastTimeGraceMinutes: 5,
    unified: true,
  },
  metadata: {
    clientRequestId: 'caller-controlled-request-id',
  },
};

function makeService(overrides: Partial<CapacityService> = {}) {
  const scheduleRepo: ScheduleRepository = {
    getSchedule: vi.fn().mockResolvedValue(schedule),
  };
  const capacityService: CapacityService = {
    checkAvailability: vi.fn().mockResolvedValue({ ok: true }),
    createBooking: vi.fn().mockResolvedValue({
      success: true,
      booking: {
        id: 'booking-1',
        restaurant_id: 'restaurant-1',
        customer_id: 'customer-1',
        booking_date: '2026-07-01',
        start_time: '19:00',
        end_time: '20:30',
        party_size: 2,
        booking_type: 'dinner',
      },
    }),
    updateBooking: vi.fn(),
    ...overrides,
  };

  return {
    service: new BookingValidationService(scheduleRepo, capacityService, {
      timeProvider: { now: () => new Date('2026-05-16T12:00:00.000Z') },
      logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    }),
    capacityService,
  };
}

describe('BookingValidationService commit failures carry the RPC code', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-16T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function commitFailure(error: string) {
    const { service } = makeService({
      createBooking: vi.fn().mockResolvedValue({
        success: false,
        error: error === 'BOOKING_CONFLICT' ? 'CAPACITY_EXCEEDED' : 'UNKNOWN',
        details: {},
        originalResult: { success: false, error, details: {} },
      }),
    });
    const thrown = await service.createWithEnforcement(baseInput, context).then(
      () => null,
      (reason: unknown) => reason,
    );
    expect(thrown).toBeInstanceOf(BookingValidationError);
    return (thrown as BookingValidationError).response.issues[0];
  }

  it('keeps the legacy CAPACITY_EXCEEDED code for a race but carries BOOKING_CONFLICT', async () => {
    const issue = await commitFailure('BOOKING_CONFLICT');
    expect(issue).toMatchObject({ code: 'CAPACITY_EXCEEDED', rpcCode: 'BOOKING_CONFLICT' });
  });

  it('carries IDEMPOTENCY_KEY_REUSED instead of relying on a details marker', async () => {
    const issue = await commitFailure('IDEMPOTENCY_KEY_REUSED');
    expect(issue).toMatchObject({ code: 'UNKNOWN', rpcCode: 'IDEMPOTENCY_KEY_REUSED' });
  });

  it('carries CAPACITY_EXCEEDED for a genuinely full slot', async () => {
    const issue = await commitFailure('CAPACITY_EXCEEDED');
    expect(issue).toMatchObject({ code: 'CAPACITY_EXCEEDED', rpcCode: 'CAPACITY_EXCEEDED' });
  });
});
