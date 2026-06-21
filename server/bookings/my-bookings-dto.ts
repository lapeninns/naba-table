import { getTodayInTimezone } from '@/lib/utils/datetime';
import { toBookingUtcIso } from '@reserve/shared/formatting/bookingDateTime';

export type MyBookingStatus = 'pending' | 'pending_allocation' | 'confirmed' | 'cancelled';

export type MyBookingDTO = {
  id: string;
  restaurantId?: string | null;
  restaurantName: string;
  restaurantSlug?: string | null;
  restaurantTimezone?: string | null;
  partySize: number;
  startIso: string;
  endIso: string;
  status: MyBookingStatus;
  notes?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  reservationIntervalMinutes?: number | null;
};

export type MyBookingsPageInfo = {
  page: number;
  pageSize: number;
  total: number;
  hasNext: boolean;
};

export type MyBookingsPageResponse = {
  items: MyBookingDTO[];
  pageInfo: MyBookingsPageInfo;
};

export type MyBookingRestaurantDetails = {
  id?: string | null;
  name: string;
  slug?: string | null;
  timezone?: string | null;
  reservation_interval_minutes?: number | null;
};

export type MyBookingRestaurant = MyBookingRestaurantDetails | MyBookingRestaurantDetails[] | null;

export type MyBookingRow = {
  id: string;
  restaurant_id: string | null;
  booking_date: string;
  start_time: string;
  end_time: string;
  start_at?: string | null;
  end_at?: string | null;
  party_size: number;
  status: MyBookingStatus;
  notes: string | null;
  restaurants: MyBookingRestaurant;
};

export type MyBookingsActivePageSelection = {
  rows: MyBookingRow[];
  total: number;
};

function deriveFallbackIso(
  date: string | null | undefined,
  time: string | null | undefined,
  timezone: string | null | undefined,
): string {
  return toBookingUtcIso(date, time, timezone) ?? '';
}

function getRestaurant(booking: MyBookingRow): MyBookingRestaurantDetails | null {
  return Array.isArray(booking.restaurants)
    ? (booking.restaurants[0] ?? null)
    : booking.restaurants;
}

export function toMyBookingDTO(booking: MyBookingRow): MyBookingDTO {
  const restaurant = getRestaurant(booking);
  const interval =
    restaurant && typeof restaurant.reservation_interval_minutes === 'number'
      ? restaurant.reservation_interval_minutes
      : null;
  const timezone = restaurant?.timezone ?? null;
  const startIso =
    (typeof booking.start_at === 'string' && booking.start_at.length > 0
      ? booking.start_at
      : null) ?? deriveFallbackIso(booking.booking_date, booking.start_time, timezone);
  const endIso =
    (typeof booking.end_at === 'string' && booking.end_at.length > 0 ? booking.end_at : null) ??
    deriveFallbackIso(booking.booking_date, booking.end_time, timezone);

  return {
    id: booking.id,
    restaurantId: booking.restaurant_id ?? null,
    restaurantName: restaurant?.name ?? '',
    restaurantSlug: restaurant?.slug ?? null,
    restaurantTimezone: timezone,
    partySize: booking.party_size,
    startIso,
    endIso,
    status: booking.status,
    notes: booking.notes,
    customerName: null,
    customerEmail: null,
    reservationIntervalMinutes: interval,
  };
}

export function buildMyBookingsPageResponse(params: {
  rows: MyBookingRow[];
  page: number;
  pageSize: number;
  total: number;
}): MyBookingsPageResponse {
  const items = params.rows.map((booking) => toMyBookingDTO(booking));

  return {
    items,
    pageInfo: {
      page: params.page,
      pageSize: params.pageSize,
      total: params.total,
      hasNext: (params.page - 1) * params.pageSize + items.length < params.total,
    },
  };
}

export function selectActiveMyBookingsPage(params: {
  rows: MyBookingRow[];
  offset: number;
  pageSize: number;
  todayForTimezone?: (timezone: string) => string;
}): MyBookingsActivePageSelection {
  const todayForTimezone = params.todayForTimezone ?? getTodayInTimezone;
  const activeRows = params.rows.filter((booking) => {
    const restaurant = getRestaurant(booking);
    const timezone =
      typeof restaurant?.timezone === 'string' && restaurant.timezone.trim().length > 0
        ? restaurant.timezone
        : 'UTC';
    const today = todayForTimezone(timezone);
    return booking.booking_date >= today;
  });

  return {
    rows: activeRows.slice(params.offset, params.offset + params.pageSize),
    total: activeRows.length,
  };
}
