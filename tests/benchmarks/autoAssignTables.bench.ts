import { bench } from 'vitest';

import { autoAssignTablesForDate } from '@/server/capacity';

import {
  createMockSupabaseClient,
  type BookingRow,
  type TableRow,
} from '../server/capacity/fixtures/mockSupabaseClient';

process.env.BASE_URL = 'http://localhost:3000';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
process.env.FEATURE_SELECTOR_SCORING = 'true';
process.env.FEATURE_OPS_METRICS = 'true';
process.env.RESEND_FROM = 'ops@example.com';
process.env.RESEND_API_KEY = 'test-resend-key';

type SeedFixture = {
  tables: TableRow[];
  bookings: BookingRow[];
};

function buildSeedInspiredFixture(): SeedFixture {
  const tables: TableRow[] = [];
  const tableCount = 48;
  for (let i = 0; i < tableCount; i += 1) {
    const capacity = 2 + (i % 5);
    tables.push({
      id: `table-${i + 1}`,
      table_number: `T${(i + 1).toString().padStart(2, '0')}`,
      capacity,
      min_party_size: Math.min(2, capacity),
      max_party_size: capacity,
      section: i % 2 === 0 ? 'Main Dining' : 'Garden',
      seating_type: 'standard',
      status: 'available',
      position: null,
    });
  }

  const bookings: BookingRow[] = [];
  const bookingCount = 120;
  const serviceDate = '2025-11-05';

  for (let i = 0; i < bookingCount; i += 1) {
    const baseHour = 17 + (i % 6);
    const minute = i % 2 === 0 ? '00' : '30';
    const startTime = `${String(baseHour).padStart(2, '0')}:${minute}`;
    const status =
      i % 15 === 0
        ? 'cancelled'
        : i % 14 === 0
          ? 'completed'
          : i % 13 === 0
            ? 'no_show'
            : i % 5 === 0
              ? 'confirmed'
              : 'pending_allocation';
    const tableAssignment =
      status === 'confirmed'
        ? [
            {
              table_id: `table-${(i % tableCount) + 1}`,
            },
          ]
        : [];

    bookings.push({
      id: `booking-${i + 1}`,
      party_size: 2 + (i % 5),
      status,
      start_time: startTime,
      end_time: null,
      start_at: `${serviceDate}T${startTime}:00+00:00`,
      booking_date: serviceDate,
      seating_preference: i % 3 === 0 ? 'window' : 'any',
      booking_table_assignments: tableAssignment,
      restaurant_id: 'rest-benchmark',
    });
  }

  return { tables, bookings };
}

bench('autoAssignTablesForDate - seed-inspired workload', async () => {
  const { tables, bookings } = buildSeedInspiredFixture();
  const { client } = createMockSupabaseClient({
    tables,
    bookings,
  });

  await autoAssignTablesForDate({
    restaurantId: 'rest-benchmark',
    date: '2025-11-05',
    client,
    assignedBy: 'benchmark',
  });
});
