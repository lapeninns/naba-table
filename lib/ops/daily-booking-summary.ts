import type {
  OpsBookingStatus,
  OpsServiceBreakdown,
  OpsServiceBreakdownPeriod,
  OpsTodayBooking,
  OpsTodayBookingsSummary,
} from '@/types/ops';

type BookingSummaryLike = Pick<OpsTodayBooking, 'status' | 'partySize' | 'bookingType'>;

export const NON_ACTIVE_BOOKING_STATUSES = new Set<OpsBookingStatus>(['cancelled', 'no_show']);

const SERVICE_PERIOD_ORDER = ['lunch', 'dinner', 'other'] as const;

type ServicePeriodKey = (typeof SERVICE_PERIOD_ORDER)[number];

type ServicePeriodTally = Record<
  ServicePeriodKey,
  {
    bookings: number;
    covers: number;
  }
>;

function createServicePeriodTally(): ServicePeriodTally {
  return {
    lunch: { bookings: 0, covers: 0 },
    dinner: { bookings: 0, covers: 0 },
    other: { bookings: 0, covers: 0 },
  };
}

export function normalizeServicePeriodKey(value: string | null | undefined): ServicePeriodKey {
  const normalized = value?.trim().toLowerCase();

  if (normalized === 'lunch') {
    return 'lunch';
  }

  if (normalized === 'dinner') {
    return 'dinner';
  }

  return 'other';
}

export function createEmptyServiceBreakdown(): OpsServiceBreakdown {
  return {
    activeBookings: 0,
    activeCovers: 0,
    periods: [],
  };
}

export function computeServiceBreakdown(bookings: BookingSummaryLike[]): OpsServiceBreakdown {
  const tallies = createServicePeriodTally();
  let activeBookings = 0;
  let activeCovers = 0;

  for (const booking of bookings) {
    if (NON_ACTIVE_BOOKING_STATUSES.has(booking.status)) {
      continue;
    }

    activeBookings += 1;
    activeCovers += booking.partySize;

    const key = normalizeServicePeriodKey(booking.bookingType);
    tallies[key].bookings += 1;
    tallies[key].covers += booking.partySize;
  }

  const periods: OpsServiceBreakdownPeriod[] = SERVICE_PERIOD_ORDER.flatMap((key) => {
    const tally = tallies[key];
    if (tally.bookings === 0 && tally.covers === 0) {
      return [];
    }

    return [
      {
        key,
        bookings: tally.bookings,
        covers: tally.covers,
      },
    ];
  });

  return {
    activeBookings,
    activeCovers,
    periods,
  };
}

export function getServiceBreakdownPeriodMap(
  serviceBreakdown: OpsServiceBreakdown | null | undefined,
): ServicePeriodTally {
  const tally = createServicePeriodTally();

  for (const period of serviceBreakdown?.periods ?? []) {
    const key = normalizeServicePeriodKey(period.key);
    tally[key] = {
      bookings: period.bookings,
      covers: period.covers,
    };
  }

  return tally;
}

export function formatServicePeriodLabel(key: string): string {
  switch (normalizeServicePeriodKey(key)) {
    case 'lunch':
      return 'Lunch';
    case 'dinner':
      return 'Dinner';
    default:
      return 'Other';
  }
}

export function formatDailyBookingSummaryMessage(
  summary: Pick<OpsTodayBookingsSummary, 'serviceBreakdown'>,
  options: { venueName: string },
): string {
  const serviceBreakdown = summary.serviceBreakdown ?? createEmptyServiceBreakdown();
  const periods = getServiceBreakdownPeriodMap(serviceBreakdown);
  const venueName = options.venueName.trim().length > 0 ? options.venueName.trim() : 'Restaurant';
  const sentences = [
    `${venueName}: Today ${serviceBreakdown.activeBookings} bkgs, ${serviceBreakdown.activeCovers} covers.`,
    `${formatServicePeriodLabel('lunch')} ${periods.lunch.bookings}/${periods.lunch.covers}.`,
    `${formatServicePeriodLabel('dinner')} ${periods.dinner.bookings}/${periods.dinner.covers}.`,
  ];

  if (periods.other.bookings > 0 || periods.other.covers > 0) {
    sentences.push(
      `${formatServicePeriodLabel('other')} ${periods.other.bookings}/${periods.other.covers}.`,
    );
  }

  sentences.push('app.nabatable.com');

  return sentences.join(' ');
}
