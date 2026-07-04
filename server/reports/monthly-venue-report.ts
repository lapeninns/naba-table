import 'server-only';

import { DateTime, type WeekdayNumbers } from 'luxon';

import { getServiceSupabaseClient } from '@/server/supabase';

const ACTIVE_STATUSES = new Set([
  'confirmed',
  'completed',
  'checked_in',
  'pending',
  'pending_allocation',
]);

// Booking channel: guest self-service bookings come through the widget/API; everything
// else (walk-in, ops-entered, phone) is staff-created. Kept as a set so new online
// sources can be added without touching the percentage math.
const ONLINE_SOURCES = new Set(['api', 'web', 'online', 'widget']);

export type MonthlyVenueReport = {
  restaurantId: string;
  restaurantName: string;
  managerName: string | null;
  contactEmail: string | null;
  timezone: string;
  month: string; // "June 2026"
  monthName: string; // "June"
  covers: {
    active: number;
    fromBookings: number;
  };
  guests: {
    firstTime: number; // customers whose first booking (row created) is in this month
    returning: number;
  };
  bookings: {
    total: number;
    onlinePercent: number;
    completedCount: number;
    cancelledCount: number;
    noShowCount: number;
    noShowPercent: number;
  };
  timing: {
    afterHoursCount: number;
    afterHoursPercent: number;
  };
  communications: {
    emailsSent: number;
    remindersSent: number;
    reviewRequestsSent: number;
    changesSentCount: number;
    smsSent: number;
  };
  moments: {
    busiestDateLabel: string | null; // "Sunday 21 June"
    busiestService: string | null; // "Lunch"
    busiestCovers: number;
    biggestParty: number;
    repeatGuests: number; // guests with 2+ visits this month
  };
  quietestDay: {
    dayName: string; // "Thursday"
    avgCoversPerDay: number;
  } | null;
  lifetime: {
    coversActive: number;
    bookingsActive: number;
    messagesSent: number;
    joinedLabel: string | null; // "December 2025"
  };
};

function timeStringToMinutes(value: string | null): number | null {
  if (!value) return null;
  const [h, m] = value.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function capitalise(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

export async function computeMonthlyVenueReport(
  restaurantId: string,
  yearMonth: { year: number; month: number }, // 1-indexed month (1=Jan..12=Dec)
): Promise<MonthlyVenueReport | null> {
  const client = getServiceSupabaseClient();

  const { data: venue, error: venueError } = await client
    .from('restaurants')
    .select('id, name, timezone, contact_email, manager_name')
    .eq('id', restaurantId)
    .maybeSingle();

  if (venueError || !venue) return null;

  const tz = venue.timezone || 'UTC';
  const startOfMonth = DateTime.fromObject(
    { year: yearMonth.year, month: yearMonth.month, day: 1 },
    { zone: tz },
  );
  const endOfMonth = startOfMonth.endOf('month');
  const monthLabel = startOfMonth.toFormat('MMMM yyyy');
  const monthName = startOfMonth.toFormat('MMMM');

  // The month's bookings are those whose MEAL falls in the month (booking_date),
  // not those created in the month. Communications and lifetime use timestamps.
  const monthStartDate = startOfMonth.toFormat('yyyy-MM-dd');
  const monthEndDate = endOfMonth.toFormat('yyyy-MM-dd');
  const monthStartUtc = startOfMonth.toUTC().toISO()!;
  const monthEndUtc = endOfMonth.plus({ day: 1 }).startOf('day').toUTC().toISO()!;

  const [
    { data: bookingRows },
    { data: hoursRows },
    { data: customerRows },
    { data: emailRows },
    { data: smsRows },
    { data: allBookingRows },
    { data: allEmailRows },
    { data: allSmsRows },
  ] = await Promise.all([
    client
      .from('bookings')
      .select('customer_id, status, party_size, booking_date, booking_type, source, created_at')
      .eq('restaurant_id', restaurantId)
      .gte('booking_date', monthStartDate)
      .lte('booking_date', monthEndDate),
    client
      .from('restaurant_operating_hours')
      .select('day_of_week, opens_at, closes_at, is_closed')
      .eq('restaurant_id', restaurantId)
      .is('effective_date', null),
    client
      .from('customers')
      .select('id, created_at')
      .eq('restaurant_id', restaurantId),
    client
      .from('email_delivery_log')
      .select('message_id, template_type')
      .eq('restaurant_id', restaurantId)
      .gte('occurred_at', monthStartUtc)
      .lt('occurred_at', monthEndUtc),
    client
      .from('sms_delivery_log')
      .select('message_sid')
      .eq('restaurant_id', restaurantId)
      .gte('occurred_at', monthStartUtc)
      .lt('occurred_at', monthEndUtc),
    client
      .from('bookings')
      .select('status, party_size, booking_date')
      .eq('restaurant_id', restaurantId),
    client.from('email_delivery_log').select('message_id').eq('restaurant_id', restaurantId),
    client.from('sms_delivery_log').select('message_sid').eq('restaurant_id', restaurantId),
  ]);

  const bookings = bookingRows ?? [];
  if (bookings.length === 0) return null; // Nothing to report — skip this venue.

  const hours = hoursRows ?? [];
  const customers = customerRows ?? [];
  const emails = emailRows ?? [];
  const sms = smsRows ?? [];

  const active = bookings.filter((b) => ACTIVE_STATUSES.has(b.status ?? ''));

  // --- Covers & booking mix -------------------------------------------------
  const coversActive = active.reduce((sum, b) => sum + (b.party_size ?? 0), 0);
  const onlineCount = bookings.filter((b) => ONLINE_SOURCES.has(b.source ?? '')).length;
  const onlinePercent = bookings.length ? Math.round((onlineCount / bookings.length) * 100) : 0;
  const completedCount = bookings.filter((b) => b.status === 'completed').length;
  const cancelledCount = bookings.filter((b) => b.status === 'cancelled').length;
  const noShowCount = bookings.filter((b) => b.status === 'no_show').length;
  const noShowPercent = bookings.length ? +((noShowCount / bookings.length) * 100).toFixed(1) : 0;

  // --- New vs returning guests ---------------------------------------------
  // A customer row is created on the guest's first booking, so created_at in the
  // month == first-time guest. Returning = the rest of this month's active guests.
  const createdThisMonth = new Set<string>();
  for (const c of customers) {
    if (!c.created_at) continue;
    const created = DateTime.fromISO(c.created_at, { zone: tz });
    if (created.year === yearMonth.year && created.month === yearMonth.month) {
      createdThisMonth.add(c.id);
    }
  }
  const activeGuestIds = new Set(
    active.map((b) => b.customer_id).filter((id): id is string => Boolean(id)),
  );
  let firstTime = 0;
  activeGuestIds.forEach((id) => {
    if (createdThisMonth.has(id)) firstTime += 1;
  });
  const returning = Math.max(0, activeGuestIds.size - firstTime);

  // --- After-hours bookings -------------------------------------------------
  // How many bookings were MADE (created_at) while the venue was closed.
  const windowsByDow = new Map<number, Array<[number, number]>>();
  for (const h of hours) {
    if (h.is_closed || h.day_of_week == null || !h.opens_at || !h.closes_at) continue;
    const open = timeStringToMinutes(h.opens_at);
    const close = timeStringToMinutes(h.closes_at);
    if (open == null || close == null) continue;
    const list = windowsByDow.get(h.day_of_week) ?? [];
    list.push([open, close]);
    windowsByDow.set(h.day_of_week, list);
  }

  let afterHoursCount = 0;
  for (const b of bookings) {
    if (!b.created_at) continue;
    const made = DateTime.fromISO(b.created_at, { zone: tz });
    const dow = made.weekday % 7; // luxon Mon=1..Sun=7 -> JS Sun=0..Sat=6
    const minutes = made.hour * 60 + made.minute;
    const windows = windowsByDow.get(dow);
    const isOpen =
      windows?.some(([o, c]) => (c > o ? minutes >= o && minutes < c : minutes >= o || minutes < c)) ??
      false;
    if (!isOpen) afterHoursCount += 1;
  }
  const afterHoursPercent = bookings.length
    ? Math.round((afterHoursCount / bookings.length) * 100)
    : 0;

  // --- Communications handled ----------------------------------------------
  const emailsByTemplate = new Map<string, Set<string>>();
  for (const e of emails) {
    const template = e.template_type ?? 'unknown';
    const set = emailsByTemplate.get(template) ?? new Set<string>();
    set.add(e.message_id);
    emailsByTemplate.set(template, set);
  }
  const countTemplate = (...keys: string[]) =>
    keys.reduce((sum, key) => sum + (emailsByTemplate.get(key)?.size ?? 0), 0);

  const emailsSent = new Set(emails.map((e) => e.message_id)).size;
  const smsSent = new Set(sms.map((s) => s.message_sid)).size;
  const remindersSent = countTemplate('reminder_24h', 'reminder_short');
  const reviewRequestsSent = countTemplate('review_request');
  const changesSentCount = countTemplate(
    'modification_confirmed',
    'modification_pending',
    'cancelled',
    'booking_rejected',
    'restaurant_cancellation',
  );

  // --- Moments --------------------------------------------------------------
  const serviceGroups = new Map<string, { date: string; service: string; covers: number }>();
  for (const b of active) {
    if (!b.booking_date) continue;
    const service = b.booking_type || 'service';
    const key = `${b.booking_date}|${service}`;
    const group = serviceGroups.get(key) ?? { date: b.booking_date, service, covers: 0 };
    group.covers += b.party_size ?? 0;
    serviceGroups.set(key, group);
  }
  let busiest: { date: string; service: string; covers: number } | null = null;
  for (const group of serviceGroups.values()) {
    if (!busiest || group.covers > busiest.covers) busiest = group;
  }

  const biggestParty = active.reduce((max, b) => Math.max(max, b.party_size ?? 0), 0);

  const visitsPerGuest = new Map<string, number>();
  for (const b of active) {
    if (!b.customer_id) continue;
    visitsPerGuest.set(b.customer_id, (visitsPerGuest.get(b.customer_id) ?? 0) + 1);
  }
  let repeatGuests = 0;
  visitsPerGuest.forEach((visits) => {
    if (visits >= 2) repeatGuests += 1;
  });

  // --- Quietest day of week -------------------------------------------------
  const coversByDow = new Map<number, { covers: number; days: Set<string> }>();
  for (const b of active) {
    if (!b.booking_date) continue;
    const dow = DateTime.fromISO(b.booking_date, { zone: tz }).weekday % 7;
    const entry = coversByDow.get(dow) ?? { covers: 0, days: new Set<string>() };
    entry.covers += b.party_size ?? 0;
    entry.days.add(b.booking_date);
    coversByDow.set(dow, entry);
  }
  let quietestDay: { dayName: string; avgCoversPerDay: number } | null = null;
  let minAvg = Infinity;
  coversByDow.forEach((entry, dow) => {
    const avg = entry.covers / entry.days.size;
    if (avg < minAvg) {
      minAvg = avg;
      quietestDay = {
        dayName: DateTime.fromObject({
          weekday: (dow === 0 ? 7 : dow) as WeekdayNumbers,
        }).toFormat('cccc'),
        avgCoversPerDay: +avg.toFixed(1),
      };
    }
  });

  // --- Lifetime -------------------------------------------------------------
  const allBookings = allBookingRows ?? [];
  const allActive = allBookings.filter((b) => ACTIVE_STATUSES.has(b.status ?? ''));
  const lifetimeCovers = allActive.reduce((sum, b) => sum + (b.party_size ?? 0), 0);
  const lifetimeMessages = new Set([
    ...(allEmailRows ?? []).map((e) => e.message_id),
    ...(allSmsRows ?? []).map((s) => s.message_sid),
  ]).size;
  const earliestDate = allBookings
    .map((b) => b.booking_date)
    .filter((d): d is string => Boolean(d))
    .sort()[0];
  const joinedLabel = earliestDate
    ? DateTime.fromISO(earliestDate, { zone: tz }).toFormat('MMMM yyyy')
    : null;

  return {
    restaurantId: venue.id,
    restaurantName: venue.name,
    managerName: venue.manager_name,
    contactEmail: venue.contact_email,
    timezone: tz,
    month: monthLabel,
    monthName,
    covers: { active: coversActive, fromBookings: active.length },
    guests: { firstTime, returning },
    bookings: {
      total: bookings.length,
      onlinePercent,
      completedCount,
      cancelledCount,
      noShowCount,
      noShowPercent,
    },
    timing: { afterHoursCount, afterHoursPercent },
    communications: {
      emailsSent,
      remindersSent,
      reviewRequestsSent,
      changesSentCount,
      smsSent,
    },
    moments: {
      busiestDateLabel: busiest
        ? DateTime.fromISO(busiest.date, { zone: tz }).toFormat('cccc d LLLL')
        : null,
      busiestService: busiest ? capitalise(busiest.service) : null,
      busiestCovers: busiest?.covers ?? 0,
      biggestParty,
      repeatGuests,
    },
    quietestDay,
    lifetime: {
      coversActive: lifetimeCovers,
      bookingsActive: allActive.length,
      messagesSent: lifetimeMessages,
      joinedLabel,
    },
  };
}

/**
 * The first Wednesday of a month is, by definition, the only Wednesday that falls
 * on days 1-7. Vercel cron fires this route every Wednesday; this guard keeps only
 * the first-of-month run.
 */
export function isFirstWednesdayOfMonth(now: DateTime = DateTime.now()): boolean {
  return now.weekday === 3 && now.day <= 7;
}
