import { createClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

import { withBookingReadOverlay } from '@/server/bookings/modification-quote-client';

import type { Database } from '@/types/supabase';

const BOOKING_ID = 'booking-1';

function createFakeClient(rowsByTable: Record<string, unknown>) {
  const requests: Array<{ method: string; url: string; body: string | null }> = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    requests.push({
      method: init?.method ?? 'GET',
      url,
      body: typeof init?.body === 'string' ? init.body : null,
    });
    const table = new URL(url).pathname.split('/').pop() ?? '';
    const headers = new Headers(init?.headers);
    const wantsObject = headers.get('Accept') === 'application/vnd.pgrst.object+json';
    const rows = (rowsByTable[table] ?? []) as unknown[];
    const payload = wantsObject ? (rows[0] ?? null) : rows;
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  const client = createClient<Database>('http://127.0.0.1:54321', 'service-role-test-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetchMock as unknown as typeof fetch },
  });
  return { client, requests };
}

const current = {
  id: BOOKING_ID,
  restaurant_id: 'rest-1',
  booking_date: '2026-07-01',
  start_time: '19:00',
  start_at: '2026-07-01T18:00:00.000Z',
  party_size: 2,
  restaurants: { timezone: 'Europe/London' },
};
const other = { ...current, id: 'booking-2' };
const overlay = {
  booking_date: '2026-07-02',
  start_time: '20:00',
  start_at: '2026-07-02T19:00:00.000Z',
  party_size: 4,
};

describe('withBookingReadOverlay', () => {
  it('shows the proposed values for the target booking through a real query-builder chain', async () => {
    const { client } = createFakeClient({ bookings: [current] });
    const overlaid = withBookingReadOverlay(client, BOOKING_ID, overlay);
    const controller = new AbortController();

    const { data, error } = await overlaid
      .from('bookings')
      .select('id, booking_date, start_time, start_at, party_size, restaurants(timezone)')
      .eq('id', BOOKING_ID)
      .abortSignal(controller.signal)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data).toEqual({ ...current, ...overlay });
  });

  it('overlays only the target row in list reads and leaves other tables untouched', async () => {
    const { client } = createFakeClient({
      bookings: [current, other],
      table_inventory: [{ id: BOOKING_ID, capacity: 4 }],
    });
    const overlaid = withBookingReadOverlay(client, BOOKING_ID, overlay);

    const bookings = await overlaid.from('bookings').select('*').eq('restaurant_id', 'rest-1');
    const tables = await overlaid.from('table_inventory').select('*');

    expect(bookings.data).toEqual([{ ...current, ...overlay }, other]);
    expect(tables.data).toEqual([{ id: BOOKING_ID, capacity: 4 }]);
  });

  it('never changes what is written or sent to RPCs', async () => {
    const { client, requests } = createFakeClient({ rpc: [] });
    const overlaid = withBookingReadOverlay(client, BOOKING_ID, overlay);

    await overlaid.rpc('create_table_hold_atomic', {
      p_booking_id: BOOKING_ID,
      p_restaurant_id: 'rest-1',
      p_zone_id: 'zone-1',
      p_table_ids: ['t1'],
      p_start_at: '2026-07-02T19:00:00.000Z',
      p_end_at: '2026-07-02T20:30:00.000Z',
      p_expires_at: '2026-07-02T18:03:00.000Z',
    });
    await overlaid.from('bookings').update({ notes: 'x' }).eq('id', BOOKING_ID);

    expect(requests.map((request) => request.method)).toEqual(['POST', 'PATCH']);
    expect(requests[1]!.body).toBe(JSON.stringify({ notes: 'x' }));
  });

  it('keeps the un-awaited query builder non-thenable', () => {
    const { client } = createFakeClient({});
    const overlaid = withBookingReadOverlay(client, BOOKING_ID, overlay);
    const builder = overlaid.from('bookings') as unknown as { then?: unknown };

    expect(builder.then).toBeUndefined();
  });
});
