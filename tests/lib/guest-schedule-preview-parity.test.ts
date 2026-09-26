import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;

const tablesRef = vi.hoisted(() => ({
  current: {} as Record<string, Array<Record<string, unknown>>>,
}));

/** In-memory stand-in for the Supabase query builder calls the guest schedule makes. */
function createFakeClient(tables: Tables) {
  const query = (rows: Row[]) => {
    let filtered = [...rows];
    const orders: Array<[string, boolean]> = [];
    const sorted = () =>
      [...filtered].sort((a, b) => {
        for (const [column, ascending] of orders) {
          const left = a[column] as string | number | null;
          const right = b[column] as string | number | null;
          if (left === right) continue;
          if (left === null) return 1;
          if (right === null) return -1;
          return (left < right ? -1 : 1) * (ascending ? 1 : -1);
        }
        return 0;
      });
    const builder = {
      select: () => builder,
      eq: (column: string, value: unknown) => {
        filtered = filtered.filter((row) => row[column] === value);
        return builder;
      },
      is: (column: string, value: unknown) => {
        filtered = filtered.filter((row) => (row[column] ?? null) === value);
        return builder;
      },
      order: (column: string, options?: { ascending?: boolean }) => {
        orders.push([column, options?.ascending ?? true]);
        return builder;
      },
      maybeSingle: () => Promise.resolve({ data: sorted()[0] ?? null, error: null }),
      then: <T>(resolve: (value: { data: Row[]; error: null }) => T) =>
        Promise.resolve({ data: sorted(), error: null }).then(resolve),
    };
    return builder;
  };
  return { from: (table: string) => query(tables[table] ?? []) };
}

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: () => createFakeClient(tablesRef.current),
}));

import { computeGuestSchedulePreview } from '@/lib/restaurants/guest-schedule/preview';
import { clearOccasionCatalogCache } from '@/server/occasions/catalog';
import { getGuestBookingSchedule } from '@/server/restaurants/guestBookingSchedule';
import { toOccasionDefinition, type RawOccasionRow } from '@reserve/shared/occasions';

import type {
  ScheduleHoursRow,
  ScheduleServicePeriod,
} from '@/lib/restaurants/guest-schedule/slots';
import type { TurnBandsByOption } from '@/lib/restaurants/guest-schedule/turn-bands';

const RESTAURANT_ID = 'restaurant-1';
const TIMEZONE = 'Europe/London';

type HoursRow = ScheduleHoursRow & { dayOfWeek: number | null; effectiveDate: string | null };

type Scenario = {
  name: string;
  rules: { interval: number | null; duration: number | null; buffer: number | null };
  hours: HoursRow[];
  periods: ScheduleServicePeriod[];
  occasions: RawOccasionRow[];
  bands: TurnBandsByOption;
  dates: string[];
  partySizes: number[];
};

const weekly = (
  dayOfWeek: number,
  opensAt: string,
  closesAt: string,
  extra: Partial<HoursRow> = {},
): HoursRow => ({
  dayOfWeek,
  effectiveDate: null,
  opensAt,
  closesAt,
  isClosed: false,
  notes: null,
  reservationIntervalMinutes: null,
  reservationSlotTimes: null,
  ...extra,
});

const override = (
  effectiveDate: string,
  opensAt: string | null,
  closesAt: string | null,
  extra: Partial<HoursRow> = {},
): HoursRow => ({
  ...weekly(0, opensAt ?? '00:00', closesAt ?? '00:00', extra),
  dayOfWeek: null,
  effectiveDate,
  opensAt,
  closesAt,
  ...extra,
});

const period = (
  id: string,
  bookingOption: string,
  dayOfWeek: number | null,
  startTime: string,
  endTime: string,
): ScheduleServicePeriod => ({
  id,
  name: bookingOption[0]!.toUpperCase() + bookingOption.slice(1),
  bookingOption,
  dayOfWeek,
  startTime,
  endTime,
});

const LUNCH: RawOccasionRow = {
  key: 'lunch',
  label: 'Lunch',
  default_duration_minutes: 90,
  display_order: 1,
  is_active: true,
  availability: [{ kind: 'anytime' }],
};
const DINNER: RawOccasionRow = {
  key: 'dinner',
  label: 'Dinner',
  default_duration_minutes: 105,
  display_order: 2,
  is_active: true,
  availability: [{ kind: 'anytime' }],
};

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];
const standardWeek = WEEKDAYS.map((day) => weekly(day, '12:00', '22:00'));
const standardPeriods = WEEKDAYS.flatMap((day) => [
  period(`l${day}`, 'lunch', day, '12:00', '14:30'),
  period(`d${day}`, 'dinner', day, '17:30', '21:30'),
]);

// 2026-09-29 is a Tuesday, 2026-10-03 a Saturday, 2026-12-24 a Thursday.
const SCENARIOS: Scenario[] = [
  {
    name: 'regular spacing, restaurant interval, default table times',
    rules: { interval: 15, duration: 90, buffer: 60 },
    hours: standardWeek,
    periods: standardPeriods,
    occasions: [LUNCH, DINNER],
    bands: {},
    dates: ['2026-09-29', '2026-10-03'],
    partySizes: [1, 2, 4, 7, 12],
  },
  {
    name: 'restaurant bands and a weekly interval',
    rules: { interval: 30, duration: 90, buffer: 45 },
    hours: standardWeek.map((row) =>
      row.dayOfWeek === 2 ? { ...row, reservationIntervalMinutes: 20 } : row,
    ),
    periods: standardPeriods,
    occasions: [LUNCH, DINNER],
    bands: {
      lunch: [
        { maxPartySize: 2, durationMinutes: 75 },
        { maxPartySize: 6, durationMinutes: 120 },
      ],
      dinner: [
        { maxPartySize: 2, durationMinutes: 90 },
        { maxPartySize: 4, durationMinutes: 150 },
        { maxPartySize: 20, durationMinutes: 400 },
      ],
    },
    dates: ['2026-09-29'],
    partySizes: [2, 3, 5, 10],
  },
  {
    name: 'weekly fixed start times, including ones outside meal times',
    rules: { interval: 15, duration: 90, buffer: 30 },
    hours: standardWeek.map((row) =>
      row.dayOfWeek === 0
        ? {
            ...row,
            closesAt: '20:00',
            reservationSlotTimes: ['11:00', '12:00', '12:30', '15:00', '18:00', '21:45'],
          }
        : row,
    ),
    periods: [
      ...standardPeriods.filter((p) => p.dayOfWeek !== 0),
      period('l0', 'lunch', 0, '12:00', '16:00'),
      period('d0', 'dinner', 0, '17:00', '19:30'),
    ],
    occasions: [LUNCH, DINNER],
    bands: {},
    dates: ['2026-10-04'],
    partySizes: [2, 6],
  },
  {
    name: 'date overrides: different hours, closures, override interval and fixed times',
    rules: { interval: 15, duration: 90, buffer: 60 },
    hours: [
      ...standardWeek.map((row) => ({ ...row, reservationIntervalMinutes: 30 })),
      override('2026-12-24', '12:00', '16:00'),
      override('2026-12-25', null, null, { isClosed: true }),
      override('2026-10-23', '17:00', '23:00', { reservationIntervalMinutes: 45 }),
      override('2026-10-24', '12:00', '22:00', {
        reservationSlotTimes: ['12:15', '13:15', '19:00'],
      }),
    ],
    periods: standardPeriods,
    occasions: [LUNCH, DINNER],
    bands: {},
    dates: ['2026-12-24', '2026-12-25', '2026-10-23', '2026-10-24'],
    partySizes: [2, 4],
  },
  {
    name: 'overlapping windows: day-specific first, then the shortest',
    rules: { interval: 30, duration: 90, buffer: 30 },
    hours: standardWeek,
    periods: [
      period('all-lunch', 'lunch', null, '11:00', '17:00'),
      period('tue-dinner', 'dinner', 2, '15:00', '21:00'),
      period('all-dinner-short', 'dinner', null, '12:00', '13:00'),
      period('brunch', 'brunch', null, '10:00', '12:00'),
    ],
    occasions: [LUNCH, DINNER],
    bands: {},
    dates: ['2026-09-29', '2026-09-30'],
    partySizes: [2],
  },
  {
    name: 'booking type rules and an inactive booking type',
    rules: { interval: 30, duration: 90, buffer: 30 },
    hours: standardWeek,
    periods: standardPeriods,
    occasions: [
      { ...LUNCH, is_active: false },
      {
        ...DINNER,
        availability: [
          { kind: 'month_only', months: [12] },
          { kind: 'time_window', start: '18:00', end: '21:00' },
        ],
      },
    ],
    bands: {},
    dates: ['2026-09-29', '2026-12-01'],
    partySizes: [2],
  },
  {
    name: 'overnight hours and null restaurant rules',
    rules: { interval: null, duration: null, buffer: null },
    hours: [weekly(5, '18:00', '02:00'), weekly(6, '12:00', '23:00')],
    periods: [
      period('late', 'dinner', null, '18:00', '23:30'),
      period('sat-lunch', 'lunch', 6, '12:00', '15:00'),
    ],
    occasions: [LUNCH, DINNER],
    bands: {},
    dates: ['2026-10-02', '2026-10-03', '2026-10-01'],
    partySizes: [2, 8],
  },
];

function toTables(scenario: Scenario): Tables {
  return {
    restaurants: [
      {
        id: RESTAURANT_ID,
        timezone: TIMEZONE,
        reservation_interval_minutes: scenario.rules.interval,
        reservation_default_duration_minutes: scenario.rules.duration,
        reservation_last_seating_buffer_minutes: scenario.rules.buffer,
      },
    ],
    restaurant_operating_hours: scenario.hours.map((row) => ({
      restaurant_id: RESTAURANT_ID,
      day_of_week: row.dayOfWeek,
      effective_date: row.effectiveDate,
      opens_at: row.opensAt,
      closes_at: row.closesAt,
      is_closed: row.isClosed,
      notes: row.notes,
      reservation_interval_minutes: row.reservationIntervalMinutes,
      reservation_slot_times: row.reservationSlotTimes,
    })),
    restaurant_service_periods: scenario.periods.map((row) => ({
      restaurant_id: RESTAURANT_ID,
      id: row.id,
      name: row.name,
      day_of_week: row.dayOfWeek,
      start_time: row.startTime,
      end_time: row.endTime,
      booking_option: row.bookingOption,
    })),
    booking_occasions: scenario.occasions.map((row) => ({ ...row, deleted_at: null })),
    restaurant_turn_bands: Object.entries(scenario.bands).flatMap(([option, bands]) =>
      bands.map((band) => ({
        restaurant_id: RESTAURANT_ID,
        booking_option: option,
        max_party_size: band.maxPartySize,
        duration_minutes: band.durationMinutes,
      })),
    ),
  };
}

function previewFor(scenario: Scenario, date: string, partySize: number) {
  const dayOfWeek = new Date(`${date}T12:00:00Z`).getUTCDay();
  const toRow = (row: HoursRow | undefined): ScheduleHoursRow | null =>
    row
      ? {
          opensAt: row.opensAt,
          closesAt: row.closesAt,
          isClosed: row.isClosed,
          notes: row.notes,
          reservationIntervalMinutes: row.reservationIntervalMinutes,
          reservationSlotTimes: row.reservationSlotTimes,
        }
      : null;
  return computeGuestSchedulePreview({
    date,
    timezone: TIMEZONE,
    partySize,
    rules: {
      intervalMinutes: scenario.rules.interval,
      defaultDurationMinutes: scenario.rules.duration,
      lastSeatingBufferMinutes: scenario.rules.buffer,
    },
    weeklyRow: toRow(
      scenario.hours.find((row) => row.effectiveDate === null && row.dayOfWeek === dayOfWeek),
    ),
    overrideRow: toRow(scenario.hours.find((row) => row.effectiveDate === date)),
    periods: scenario.periods,
    occasions: scenario.occasions.map(toOccasionDefinition),
    turnBandsByOption: scenario.bands,
  });
}

describe('booking preview parity with the live guest schedule', () => {
  beforeEach(() => {
    clearOccasionCatalogCache();
  });

  for (const scenario of SCENARIOS) {
    for (const date of scenario.dates) {
      for (const partySize of scenario.partySizes) {
        it(`${scenario.name} — ${date}, party of ${partySize}`, async () => {
          tablesRef.current = toTables(scenario);
          clearOccasionCatalogCache();
          const client = createFakeClient(tablesRef.current);
          const live = await getGuestBookingSchedule(RESTAURANT_ID, {
            date,
            partySize,
            client: client as unknown as NonNullable<
              Parameters<typeof getGuestBookingSchedule>[1]['client']
            >,
          });
          const preview = previewFor(scenario, date, partySize);

          const liveOffered = live.slots
            .filter((slot) => !slot.disabled)
            .map((slot) => ({
              value: slot.value,
              bookingOption: slot.bookingOption,
              durationMinutes: slot.durationMinutes,
            }));
          expect(preview.offered).toEqual(liveOffered);

          const liveDisabled = live.slots.filter((slot) => slot.disabled).map((slot) => slot.value);
          const previewDisabled = preview.excluded
            .filter((entry) => entry.exclusion.kind === 'not_available_on_date')
            .map((entry) => entry.value);
          // A disabled slot the window also rejects is dropped by the server; the preview still
          // explains it, so compare only the ones the server keeps.
          expect(previewDisabled.filter((value) => liveDisabled.includes(value))).toEqual(
            liveDisabled,
          );

          expect(preview.isClosed).toBe(live.isClosed);
          expect(preview.hours.intervalMinutes).toBe(live.intervalMinutes);
          expect(preview.lastSeatingBufferMinutes).toBe(live.lastSeatingBufferMinutes);
        });
      }
    }
  }
});

describe('booking preview reasons', () => {
  it('explains every start time it does not offer', () => {
    const scenario = SCENARIOS[0]!;
    const preview = previewFor(scenario, '2026-09-29', 12);
    const kinds = new Set(preview.excluded.map((entry) => entry.exclusion.kind));

    expect(kinds).toContain('outside_meal_times');
    expect(kinds).toContain('after_last_seating');
    expect(
      preview.excluded.find((entry) => entry.exclusion.kind === 'after_last_seating')?.exclusion,
    ).toEqual({
      kind: 'after_last_seating',
      lastSeating: '21:00',
    });
    expect(preview.offered.length + preview.excluded.length).toBe((22 - 12) * 4);
  });

  it('reports hours past midnight as overnight', () => {
    const preview = previewFor(SCENARIOS[6]!, '2026-10-02', 2);

    expect(preview.isOvernight).toBe(true);
    expect(preview.offered).toEqual([]);
    const kinds = new Set(preview.excluded.map((entry) => entry.exclusion.kind));
    // Starts inside the 18:00–23:30 meal window fail as overnight; later ones are outside it.
    expect(kinds).toEqual(new Set(['overnight_hours', 'outside_meal_times']));
  });

  it('reports a table time that runs past closing', () => {
    const preview = previewFor(SCENARIOS[1]!, '2026-09-29', 3);

    expect(preview.excluded).toContainEqual({
      value: '21:00',
      exclusion: { kind: 'runs_past_closing', durationMinutes: 150, closesAt: '22:00' },
    });
  });
});
