import { describe, expect, it } from 'vitest';

import { getRestaurantSchedule } from '@/server/restaurants/schedule';

type Row = Record<string, unknown>;

class QueryBuilder {
  private filters: Array<(row: Row) => boolean> = [];
  private single = false;

  constructor(
    private readonly table: string,
    private readonly rowsByTable: Record<string, Row[]>,
  ) {}

  select() {
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  is(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  order() {
    return this;
  }

  maybeSingle() {
    this.single = true;
    return this.execute();
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute() {
    const rows = (this.rowsByTable[this.table] ?? []).filter((row) =>
      this.filters.every((filter) => filter(row)),
    );
    if (this.single) {
      return { data: rows[0] ?? null, error: null };
    }
    return { data: rows, error: null };
  }
}

function installScheduleClient(rowsByTable: Record<string, Row[]>) {
  return {
    from: (table: string) => new QueryBuilder(table, rowsByTable),
  };
}

describe('getRestaurantSchedule', () => {
  it('treats a midnight close as the next day boundary', async () => {
    const client = installScheduleClient({
      restaurants: [
        {
          id: 'restaurant-1',
          timezone: 'Europe/London',
          reservation_interval_minutes: 15,
          reservation_default_duration_minutes: 90,
          reservation_last_seating_buffer_minutes: 90,
        },
      ],
      restaurant_operating_hours: [
        {
          restaurant_id: 'restaurant-1',
          day_of_week: 5,
          effective_date: null,
          opens_at: '12:00:00',
          closes_at: '00:00:00',
          is_closed: false,
          notes: null,
          reservation_interval_minutes: null,
          reservation_slot_times: null,
        },
      ],
      restaurant_service_periods: [
        {
          id: 'dinner-1',
          restaurant_id: 'restaurant-1',
          name: 'Friday Dinner',
          day_of_week: 5,
          start_time: '17:00:00',
          end_time: '00:00:00',
          booking_option: 'dinner',
        },
      ],
      booking_occasions: [],
    });

    const schedule = await getRestaurantSchedule('restaurant-1', {
      date: '2026-05-15',
      client,
    });

    expect(schedule.isClosed).toBe(false);
    expect(schedule.window).toMatchObject({ opensAt: '12:00', closesAt: '00:00' });
    expect(schedule.slots.at(0)?.value).toBe('17:00');
    expect(schedule.slots.at(-1)?.value).toBe('23:45');
  });

  it('keeps equal open and close times closed', async () => {
    const client = installScheduleClient({
      restaurants: [
        {
          id: 'restaurant-1',
          timezone: 'Europe/London',
          reservation_interval_minutes: 15,
          reservation_default_duration_minutes: 90,
          reservation_last_seating_buffer_minutes: 90,
        },
      ],
      restaurant_operating_hours: [
        {
          restaurant_id: 'restaurant-1',
          day_of_week: 5,
          effective_date: null,
          opens_at: '12:00:00',
          closes_at: '12:00:00',
          is_closed: false,
          notes: null,
          reservation_interval_minutes: null,
          reservation_slot_times: null,
        },
      ],
      restaurant_service_periods: [
        {
          id: 'dinner-1',
          restaurant_id: 'restaurant-1',
          name: 'Friday Dinner',
          day_of_week: 5,
          start_time: '17:00:00',
          end_time: '22:00:00',
          booking_option: 'dinner',
        },
      ],
      booking_occasions: [],
    });

    const schedule = await getRestaurantSchedule('restaurant-1', {
      date: '2026-05-15',
      client,
    });

    expect(schedule.isClosed).toBe(true);
    expect(schedule.slots).toHaveLength(0);
  });
});
