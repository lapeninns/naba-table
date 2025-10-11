import { describe, expect, it, vi } from 'vitest';

import { getAllCustomersWithProfiles, getCustomersWithProfiles } from '@/server/ops/customers';

type ClientType = NonNullable<Parameters<typeof getCustomersWithProfiles>[0]['client']>;

type QueryMocks = {
  from: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  range: ReturnType<typeof vi.fn>;
};

const sampleRow = {
  id: 'cust-1',
  restaurant_id: 'rest-1',
  full_name: 'Test Customer',
  email: 'test@example.com',
  phone: '+11234567890',
  marketing_opt_in: true,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-02T00:00:00Z',
  customer_profiles: [
    {
      first_booking_at: '2025-01-03T18:00:00Z',
      last_booking_at: '2025-01-04T20:00:00Z',
      total_bookings: 2,
      total_covers: 4,
      total_cancellations: 0,
    },
  ],
};

function buildClient(range?: ReturnType<typeof vi.fn>): { client: ClientType; mocks: QueryMocks } {
  const rangeMock =
    range ?? vi.fn().mockResolvedValue({ data: [sampleRow], count: 1, error: null });
  const order = vi.fn().mockReturnValue({ range: rangeMock });
  const eq = vi.fn().mockReturnValue({ order });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });

  const client = { from } as unknown as ClientType;

  return {
    client,
    mocks: {
      from,
      select,
      eq,
      order,
      range: rangeMock,
    },
  };
}

describe('getCustomersWithProfiles ordering', () => {
  it('orders by last_booking_at on customer_profiles with nulls last by default', async () => {
    const { client, mocks } = buildClient();

    const result = await getCustomersWithProfiles({ restaurantId: 'rest-1', client });

    expect(result.customers).toHaveLength(1);
    expect(mocks.from).toHaveBeenCalledWith('customers');
    expect(mocks.eq).toHaveBeenCalledWith('restaurant_id', 'rest-1');
    expect(mocks.order).toHaveBeenCalledWith('last_booking_at', {
      ascending: false,
      nullsFirst: false,
      foreignTable: 'customer_profiles',
    });
    expect(mocks.range).toHaveBeenCalledWith(0, 9);
  });

  it('respects ascending sort order when requested', async () => {
    const { client, mocks } = buildClient();

    await getCustomersWithProfiles({ restaurantId: 'rest-1', client, sortOrder: 'asc' });

    expect(mocks.order).toHaveBeenCalledWith('last_booking_at', {
      ascending: true,
      nullsFirst: false,
      foreignTable: 'customer_profiles',
    });
  });
});

describe('getAllCustomersWithProfiles', () => {
  it('aggregates across multiple pages when hasNext is true', async () => {
    const secondRow = {
      ...sampleRow,
      id: 'cust-2',
      email: 'second@example.com',
    };

    const range = vi
      .fn()
      .mockResolvedValueOnce({ data: [sampleRow], count: 2, error: null })
      .mockResolvedValueOnce({ data: [secondRow], count: 2, error: null });

    const { client, mocks } = buildClient(range);

    const customers = await getAllCustomersWithProfiles({
      restaurantId: 'rest-1',
      client,
      batchSize: 1,
    });

    expect(customers).toHaveLength(2);
    expect(customers[0].id).toBe('cust-1');
    expect(customers[1].id).toBe('cust-2');
    expect(mocks.range).toHaveBeenNthCalledWith(1, 0, 0);
    expect(mocks.range).toHaveBeenNthCalledWith(2, 1, 1);
    expect(mocks.range).toHaveBeenCalledTimes(2);
  });

  it('returns an empty array when no customers exist', async () => {
    const range = vi.fn().mockResolvedValue({ data: [], count: 0, error: null });
    const { client } = buildClient(range);

    const customers = await getAllCustomersWithProfiles({
      restaurantId: 'rest-1',
      client,
      batchSize: 10,
    });

    expect(customers).toEqual([]);
  });
});
