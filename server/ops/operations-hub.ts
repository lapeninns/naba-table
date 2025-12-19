import { DateTime } from 'luxon';

import { getTableAvailabilityTimeline } from '@/server/ops/table-timeline';

import type {
  TableTimelineSegment,
  TableTimelineSegmentState,
} from '@/types/ops';
import type {
  OperationsHubFeedItem,
  OperationsHubResponse,
  OperationsHubStatus,
} from '@/types/ops-operations-hub';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type Params = {
  restaurantId: string;
  date?: string;
  zoneId?: string;
  service?: 'lunch' | 'dinner' | 'all';
  client: SupabaseClient<Database, 'public'>;
};

export async function buildOperationsHub({ restaurantId, date, zoneId, service = 'all', client }: Params): Promise<OperationsHubResponse> {
  const timeline = await getTableAvailabilityTimeline({
    restaurantId,
    date,
    zoneId,
    service,
    client,
  });

  const timezone = timeline.timezone || 'UTC';

  const windowStart = timeline.window.start ? DateTime.fromISO(timeline.window.start).setZone(timezone) : null;
  const windowEnd = timeline.window.end ? DateTime.fromISO(timeline.window.end).setZone(timezone) : null;

  const responseStart = windowStart?.isValid ? windowStart.toFormat('HH:mm') : '17:00';
  const responseEnd = windowEnd?.isValid ? windowEnd.toFormat('HH:mm') : '23:00';

  const tables = timeline.tables.map((row) => ({
    id: row.table.id,
    name: `T${row.table.tableNumber}`,
    capacity: row.table.capacity,
    zone: row.table.zoneName ?? null,
    zoneId: row.table.zoneId ?? null,
  }));

  const now = DateTime.now().setZone(timezone);

  const reservations = timeline.tables.flatMap((row) => {
    return row.segments
      .filter((segment) => segment.state !== 'available')
      .map((segment) => {
        const start = DateTime.fromISO(segment.start).setZone(timezone);
        const end = DateTime.fromISO(segment.end).setZone(timezone);

        return {
          id: buildReservationId(row.table.id, segment),
          tableId: row.table.id,
          name: segment.booking?.customerName ?? 'Guest',
          guests: segment.booking?.partySize ?? 0,
          start: start.isValid ? start.toFormat('HH:mm') : '00:00',
          end: end.isValid ? end.toFormat('HH:mm') : '00:00',
          status: mapSegmentToHubStatus(segment, now),
          bookingId: segment.booking?.id ?? null,
        };
      });
  });

  const kpis = computeKpis({ timeline, reservations });
  const feed = buildFeed({ reservations, now });

  return {
    date: timeline.date,
    timezone,
    window: { start: responseStart, end: responseEnd },
    tables,
    reservations,
    kpis,
    feed,
  };
}

function buildReservationId(tableId: string, segment: TableTimelineSegment) {
  const start = safeKey(segment.start);
  const end = safeKey(segment.end);
  const booking = segment.booking?.id ? safeKey(segment.booking.id) : 'none';
  const hold = segment.hold?.id ? safeKey(segment.hold.id) : 'none';
  return `${tableId}:${start}:${end}:${segment.state}:${booking}:${hold}`;
}

function safeKey(value: string) {
  return value.replace(/[^a-zA-Z0-9:_-]/g, '_');
}

function mapSegmentToHubStatus(segment: TableTimelineSegment, now: DateTime): OperationsHubStatus {
  const start = DateTime.fromISO(segment.start);
  const end = DateTime.fromISO(segment.end);

  if (segment.state === 'hold') {
    return now.isValid && end.isValid && now > end ? 'overdue' : 'arriving';
  }

  if (segment.state === 'out_of_service') {
    return 'finishing';
  }

  const bookingStatus = segment.booking?.status;
  if (bookingStatus === 'checked_in') return 'seated';
  if (bookingStatus === 'completed') return 'finishing';
  if (bookingStatus === 'confirmed' || bookingStatus === 'pending' || bookingStatus === 'pending_allocation') {
    if (now.isValid && start.isValid && end.isValid) {
      if (now > end) return 'overdue';
      if (now >= start.minus({ minutes: 10 }) && now < start) return 'arriving';
      if (now >= start && now <= end) return 'seated';
    }
    return 'arriving';
  }

  return 'arriving';
}

function computeKpis({
  timeline,
  reservations,
}: {
  timeline: Awaited<ReturnType<typeof getTableAvailabilityTimeline>>;
  reservations: OperationsHubResponse['reservations'];
}): OperationsHubResponse['kpis'] {
  const totalCapacity = timeline.summary?.totalCapacity ?? timeline.tables.reduce((sum, row) => sum + row.table.capacity, 0);
  const occupied = reservations.reduce((sum, r) => sum + (Number.isFinite(r.guests) ? r.guests : 0), 0);
  const occupancyPercentage = totalCapacity > 0 ? Math.min(100, Math.max(0, Math.round((occupied / totalCapacity) * 100))) : 0;

  const bookingsCount = timeline.tables.reduce((count, row) => {
    return (
      count +
      row.segments.filter((segment) => segment.state === 'reserved' && Boolean(segment.booking?.id)).length
    );
  }, 0);

  const alertsCount = reservations.filter((reservation) => reservation.status === 'overdue').length;

  const durations = timeline.tables.flatMap((row) => {
    return row.segments
      .filter((segment) => segment.state === 'reserved' && segment.booking)
      .map((segment) => {
        const start = DateTime.fromISO(segment.start);
        const end = DateTime.fromISO(segment.end);
        if (!start.isValid || !end.isValid) return null;
        const minutes = end.diff(start, 'minutes').minutes;
        return Number.isFinite(minutes) ? Math.max(0, Math.round(minutes)) : null;
      })
      .filter((value): value is number => typeof value === 'number');
  });

  const turnRateMinutes = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null;

  return {
    occupancyPercentage,
    turnRateMinutes,
    bookingsCount,
    alertsCount,
  };
}

function buildFeed({
  reservations,
  now,
}: {
  reservations: OperationsHubResponse['reservations'];
  now: DateTime;
}): OperationsHubFeedItem[] {
  const items: OperationsHubFeedItem[] = [];

  for (const reservation of reservations) {
    if (reservation.status === 'overdue') {
      items.push({
        id: `feed:overdue:${reservation.id}`,
        time: now.toFormat('HH:mm:ss'),
        title: 'Overdue',
        detail: `${reservation.tableId} · ${reservation.guests} guests · ${reservation.end}`,
        priority: 'high',
      });
    }
  }

  for (const reservation of reservations) {
    if (reservation.status === 'arriving') {
      items.push({
        id: `feed:arriving:${reservation.id}`,
        time: now.toFormat('HH:mm:ss'),
        title: 'Arriving',
        detail: `${reservation.tableId} · ${reservation.name} · ${reservation.start}`,
        priority: 'attention',
      });
    }
  }

  items.push({
    id: 'feed:sync',
    time: now.toFormat('HH:mm:ss'),
    title: 'Live sync',
    detail: 'Timeline updated',
    priority: 'log',
  });

  return items.slice(0, 20);
}

export function mapTimelineStateToHub(state: TableTimelineSegmentState): OperationsHubStatus {
  if (state === 'hold') return 'arriving';
  if (state === 'reserved') return 'seated';
  if (state === 'out_of_service') return 'finishing';
  return 'arriving';
}
