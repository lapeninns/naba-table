import { describe, expect, it, vi } from 'vitest';

import { getRestaurantSchedule } from '@/server/restaurants/schedule';

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: () => {
    throw new Error('Unexpected call in unit test');
  },
}));

vi.mock('@/server/occasions/catalog', () => ({
  getOccasionCatalog: async () => {
    const lunchDefinition = {
      key: 'lunch',
      label: 'Lunch',
      shortLabel: 'Lunch',
      description: null,
      availability: [],
      defaultDurationMinutes: 90,
      displayOrder: 10,
      isActive: true,
    } as const;
    const drinksDefinition = {
      key: 'drinks',
      label: 'Drinks',
      shortLabel: 'Drinks',
      description: null,
      availability: [],
      defaultDurationMinutes: 60,
      displayOrder: 20,
      isActive: true,
    } as const;
    const dinnerDefinition = {
      key: 'dinner',
      label: 'Dinner',
      shortLabel: 'Dinner',
      description: null,
      availability: [],
      defaultDurationMinutes: 120,
      displayOrder: 30,
      isActive: true,
    } as const;
    const definitions = [lunchDefinition, drinksDefinition, dinnerDefinition];
    return {
      definitions,
      byKey: new Map(definitions.map((definition) => [definition.key, definition])),
      orderedKeys: definitions.map((definition) => definition.key),
    };
  },
}));

type SelectResult<T> = Promise<{ data: T; error: null }>;
type ScheduleOptions = Exclude<Parameters<typeof getRestaurantSchedule>[1], undefined>;
type ScheduleClient = NonNullable<ScheduleOptions['client']>;

function createStubClient({
  restaurant,
  weeklyHours,
  overrideHours,
  servicePeriods,
}: {
  restaurant: Record<string, unknown>;
  weeklyHours: Record<string, unknown> | null;
  overrideHours: Record<string, unknown> | null;
  servicePeriods: Record<string, unknown>[];
}): ScheduleClient {
  const stub = {
    from(table: string) {
      if (table === 'restaurants') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: restaurant, error: null }),
            }),
          }),
        };
      }

      if (table === 'restaurant_operating_hours') {
        const filters: Record<string, unknown> = {};
        const chain = {
          select: () => chain,
          eq: (column: string, value: unknown) => {
            filters[column] = value;
            return chain;
          },
          is: (column: string, value: unknown) => {
            filters[column] = value;
            return chain;
          },
          maybeSingle: async () => {
            const isOverride = filters.effective_date !== null && filters.effective_date !== undefined;
            return {
              data: isOverride ? overrideHours : weeklyHours,
              error: null,
            } as SelectResult<Record<string, unknown> | null>;
          },
        };
        return chain;
      }

      if (table === 'restaurant_service_periods') {
        const chain = {
          select: () => chain,
          eq: () => chain,
          order: () => ({
            order: async () => ({ data: servicePeriods, error: null } as SelectResult<
              Record<string, unknown>[]
            >),
          }),
        };
        return chain;
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };
  return stub as unknown as ScheduleClient;
}

describe('getRestaurantSchedule', () => {
  it('omits slots that would extend past closing when buffer applies', async () => {
    const client = createStubClient({
      restaurant: {
        id: 'rest-1',
        timezone: 'Europe/London',
        reservation_interval_minutes: 15,
        reservation_default_duration_minutes: 90,
        reservation_last_seating_buffer_minutes: 120,
      },
      weeklyHours: {
        opens_at: '12:00:00',
        closes_at: '22:00:00',
        is_closed: false,
      },
      overrideHours: null,
      servicePeriods: [
        {
          id: 'period-dinner',
          name: 'Dinner Service',
          day_of_week: null,
          start_time: '17:00:00',
          end_time: '22:00:00',
          booking_option: 'dinner',
        },
      ],
    });

    const schedule = await getRestaurantSchedule('rest-1', {
      date: '2025-05-15',
      client,
    });

    expect(schedule.lastSeatingBufferMinutes).toBe(120);
    const lastSlot = schedule.slots.at(-1);
    expect(lastSlot?.value).toBe('20:00');
    expect(schedule.slots.some((slot) => slot.value === '21:00')).toBe(false);
  });

  it('prefers lunch/dinner over overlapping drinks coverage', async () => {
    const client = createStubClient({
      restaurant: {
        id: 'rest-1',
        timezone: 'Europe/London',
        reservation_interval_minutes: 60,
        reservation_default_duration_minutes: 90,
        reservation_last_seating_buffer_minutes: 90,
      },
      weeklyHours: {
        opens_at: '12:00:00',
        closes_at: '22:00:00',
        is_closed: false,
      },
      overrideHours: null,
      servicePeriods: [
        {
          id: 'weekday-lunch',
          name: 'Weekday Lunch',
          day_of_week: 4,
          start_time: '12:00:00',
          end_time: '15:00:00',
          booking_option: 'lunch',
        },
        {
          id: 'weekday-dinner',
          name: 'Weekday Dinner',
          day_of_week: 4,
          start_time: '17:00:00',
          end_time: '22:00:00',
          booking_option: 'dinner',
        },
        {
          id: 'weekday-drinks',
          name: 'Weekday Drinks',
          day_of_week: 4,
          start_time: '12:00:00',
          end_time: '22:00:00',
          booking_option: 'drinks',
        },
      ],
    });

    const schedule = await getRestaurantSchedule('rest-1', {
      date: '2025-05-15', // Thursday
      client,
    });

    const lunchSlot = schedule.slots.find((slot) => slot.value === '12:00');
    const drinksSlot = schedule.slots.find((slot) => slot.value === '15:00');
    const dinnerSlot = schedule.slots.find((slot) => slot.value === '17:00');

    expect(lunchSlot?.defaultBookingOption).toBe('lunch');
    expect(drinksSlot?.defaultBookingOption).toBe('drinks');
    expect(dinnerSlot?.defaultBookingOption).toBe('dinner');
  });

  it('falls back to drinks when only the drinks period covers a slot', async () => {
    const client = createStubClient({
      restaurant: {
        id: 'rest-1',
        timezone: 'Europe/London',
        reservation_interval_minutes: 60,
        reservation_default_duration_minutes: 90,
        reservation_last_seating_buffer_minutes: 90,
      },
      weeklyHours: {
        opens_at: '12:00:00',
        closes_at: '22:00:00',
        is_closed: false,
      },
      overrideHours: null,
      servicePeriods: [
        {
          id: 'weekday-drinks',
          name: 'Weekday Drinks',
          day_of_week: null,
          start_time: '12:00:00',
          end_time: '22:00:00',
          booking_option: 'drinks',
        },
      ],
    });

    const schedule = await getRestaurantSchedule('rest-1', {
      date: '2025-05-15',
      client,
    });

    const slot = schedule.slots.find((entry) => entry.value === '14:00');
    expect(slot?.defaultBookingOption).toBe('drinks');
  });
});
