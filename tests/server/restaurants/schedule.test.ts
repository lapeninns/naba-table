import { describe, expect, it, vi } from 'vitest';

import { getRestaurantSchedule } from '@/server/restaurants/schedule';

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: () => {
    throw new Error('Unexpected call in unit test');
  },
}));

vi.mock('@/server/occasions/catalog', () => ({
  getOccasionCatalog: async () => {
    const dinnerDefinition = {
      key: 'dinner',
      label: 'Dinner',
      shortLabel: 'Dinner',
      description: null,
      availability: [],
      defaultDurationMinutes: 120,
      displayOrder: 10,
      isActive: true,
    } as const;
    return {
      definitions: [dinnerDefinition],
      byKey: new Map([[dinnerDefinition.key, dinnerDefinition]]),
      orderedKeys: [dinnerDefinition.key],
    };
  },
}));

type SelectResult<T> = Promise<{ data: T; error: null }>;

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
}) {
  return {
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
      client: client as any,
    });

    expect(schedule.lastSeatingBufferMinutes).toBe(120);
    const lastSlot = schedule.slots.at(-1);
    expect(lastSlot?.value).toBe('20:00');
    expect(schedule.slots.some((slot) => slot.value === '21:00')).toBe(false);
  });
});
