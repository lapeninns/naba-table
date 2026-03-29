import { describe, expect, it, vi } from 'vitest';

import { getAllCustomersWithHistory, getCustomersWithHistory } from '@/server/ops/customers';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database, 'public'>;
type FeedRow = Database['public']['Functions']['ops_customers_history_feed']['Returns'][number];
type SummaryRow = Database['public']['Functions']['ops_customers_history_summary']['Returns'][number];

function makeFeedRow(overrides: Partial<FeedRow> = {}): FeedRow {
  return {
    id: 'guest-1',
    restaurant_id: 'rest-1',
    name: 'Alex Johnson',
    email: 'alex@example.com',
    phone: '+447700900123',
    marketing_opt_in: true,
    created_at: '2026-03-01T12:00:00Z',
    updated_at: '2026-03-20T12:00:00Z',
    first_booking_at: '2026-03-10T18:00:00Z',
    last_visit_at: '2026-03-20T18:00:00Z',
    total_bookings: 6,
    total_covers: 20,
    total_cancellations: 1,
    total_count: 1,
    ...overrides,
  };
}

function makeSummaryRow(overrides: Partial<SummaryRow> = {}): SummaryRow {
  return {
    total: 7,
    opted_in: 3,
    opted_out: 4,
    returning: 5,
    vip: 2,
    never_visited: 1,
    ...overrides,
  };
}

function createRpcClient(options: {
  onFeed: (args: Record<string, unknown>) => FeedRow[];
  onSummary?: (args: Record<string, unknown>) => SummaryRow[];
}): DbClient {
  const rpc = vi.fn(async (fn: string, args: Record<string, unknown>) => {
    if (fn === 'ops_customers_history_feed') {
      return { data: options.onFeed(args), error: null };
    }

    if (fn === 'ops_customers_history_summary') {
      return { data: options.onSummary ? options.onSummary(args) : [], error: null };
    }

    throw new Error(`Unexpected rpc ${fn}`);
  });

  return { rpc } as unknown as DbClient;
}

describe('server/ops/customers RPC path', () => {
  it('maps paged feed rows and summary rows from RPC results', async () => {
    const client = createRpcClient({
      onFeed: () => [
        makeFeedRow({ id: 'guest-1', total_count: 7 }),
        makeFeedRow({ id: 'guest-2', email: 'sam@example.com', name: 'Sam Patel', total_count: 7 }),
        makeFeedRow({ id: 'guest-3', email: 'jamie@example.com', name: 'Jamie Fox', total_count: 7 }),
      ],
      onSummary: () => [makeSummaryRow()],
    });

    const result = await getCustomersWithHistory({
      restaurantId: 'rest-1',
      page: 1,
      pageSize: 2,
      search: ' alex ',
      includeSummary: true,
      client,
    });

    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(2);
    expect(result.total).toBe(7);
    expect(result.hasNext).toBe(true);
    expect(result.customers.map((customer) => customer.id)).toEqual(['guest-1', 'guest-2']);
    expect(result.summary).toEqual({
      total: 7,
      optedIn: 3,
      optedOut: 4,
      returning: 5,
      vip: 2,
      neverVisited: 1,
    });
  });

  it('pages through the feed RPC to collect all rows for export', async () => {
    const client = createRpcClient({
      onFeed: (args) => {
        const page = Number(args.p_page ?? 1);
        if (page === 1) {
          return Array.from({ length: 501 }, (_, index) =>
            makeFeedRow({
              id: `guest-${index + 1}`,
              email: `guest-${index + 1}@example.com`,
              name: `Guest ${index + 1}`,
              total_count: 502,
            }),
          );
        }

        return [
          makeFeedRow({
            id: 'guest-501',
            email: 'guest-501@example.com',
            name: 'Guest 501',
            total_count: 502,
          }),
          makeFeedRow({
            id: 'guest-502',
            email: 'guest-502@example.com',
            name: 'Guest 502',
            total_count: 502,
          }),
        ];
      },
    });

    const rows = await getAllCustomersWithHistory({
      restaurantId: 'rest-1',
      client,
    });

    expect(rows).toHaveLength(502);
    expect(rows[0]?.id).toBe('guest-1');
    expect(rows.at(-1)?.id).toBe('guest-502');
  });
});
