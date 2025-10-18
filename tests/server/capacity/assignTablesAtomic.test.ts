import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { env } from '@/lib/env';

process.env.BASE_URL = 'http://localhost:3000';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

type AssignTableFn = typeof import('@/server/capacity/tables')['assignTableToBooking'];
type UnassignTableFn = typeof import('@/server/capacity/tables')['unassignTableFromBooking'];

let assignTableToBooking: AssignTableFn;
let unassignTableFromBooking: UnassignTableFn;

beforeAll(async () => {
  ({ assignTableToBooking, unassignTableFromBooking } = await import('@/server/capacity/tables'));
});

describe('assignTableToBooking (atomic wrapper)', () => {
  let featureFlagsSpy: ReturnType<typeof vi.spyOn> | null = null;

  beforeEach(() => {
    featureFlagsSpy = vi.spyOn(env, 'featureFlags', 'get');
  });

  afterEach(() => {
    featureFlagsSpy?.mockRestore();
    featureFlagsSpy = null;
  });

  it('invokes assign_tables_atomic when atomic flags enabled', async () => {
    featureFlagsSpy?.mockReturnValue({
      ...env.featureFlags,
      assignAtomic: true,
      rpcAssignAtomic: true,
      allocationsDualWrite: true,
    });

    const bookingRow = {
      id: 'booking-1',
      restaurant_id: 'restaurant-1',
      booking_date: '2025-01-01',
      start_time: '18:00',
      end_time: '20:00',
      start_at: '2025-01-01T18:00:00.000Z',
      end_at: '2025-01-01T20:00:00.000Z',
      restaurants: { timezone: 'UTC' },
    };

    const maybeSingle = vi.fn().mockResolvedValue({ data: bookingRow, error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });

    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          table_id: 'table-1',
          assignment_id: 'assignment-1',
          merge_group_id: null,
        },
      ],
      error: null,
    });

    const client = {
      from,
      rpc,
    } as unknown as Parameters<AssignTableFn>[3];

    const result = await assignTableToBooking('booking-1', 'table-1', 'user-1', client, {
      idempotencyKey: 'test-key',
    });

    expect(from).toHaveBeenCalledWith('bookings');
    expect(eq).toHaveBeenCalledWith('id', 'booking-1');
    expect(rpc).toHaveBeenCalledWith('assign_tables_atomic', {
      p_booking_id: 'booking-1',
      p_table_ids: ['table-1'],
      p_window: '[2025-01-01T18:00:00Z,2025-01-01T20:00:00Z)',
      p_assigned_by: 'user-1',
      p_idempotency_key: 'test-key',
    });
    expect(result).toBe('assignment-1');
  });

  it('falls back to legacy RPC when atomic flags disabled', async () => {
    featureFlagsSpy?.mockReturnValue({
      ...env.featureFlags,
      assignAtomic: false,
      rpcAssignAtomic: false,
      allocationsDualWrite: false,
    });

    const rpc = vi.fn().mockResolvedValue({ data: 'legacy-assignment', error: null });
    const client = {
      rpc,
    } as unknown as Parameters<AssignTableFn>[3];

    const result = await assignTableToBooking('booking-1', 'table-1', 'user-1', client);

    expect(rpc).toHaveBeenCalledWith('assign_table_to_booking', {
      p_booking_id: 'booking-1',
      p_table_id: 'table-1',
      p_assigned_by: 'user-1',
      p_notes: null,
    });
    expect(result).toBe('legacy-assignment');
  });
});

describe('unassignTableFromBooking (atomic wrapper)', () => {
  let featureFlagsSpy: ReturnType<typeof vi.spyOn> | null = null;

  beforeEach(() => {
    featureFlagsSpy = vi.spyOn(env, 'featureFlags', 'get');
  });

  afterEach(() => {
    featureFlagsSpy?.mockRestore();
    featureFlagsSpy = null;
  });

  it('invokes unassign_tables_atomic when flags enabled', async () => {
    featureFlagsSpy?.mockReturnValue({
      ...env.featureFlags,
      assignAtomic: true,
      rpcAssignAtomic: true,
      allocationsDualWrite: true,
    });

    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          table_id: 'table-1',
          merge_group_id: null,
        },
      ],
      error: null,
    });

    const client = {
      rpc,
    } as unknown as Parameters<UnassignTableFn>[2];

    const result = await unassignTableFromBooking('booking-1', 'table-1', client);

    expect(rpc).toHaveBeenCalledWith('unassign_tables_atomic', {
      p_booking_id: 'booking-1',
      p_table_ids: ['table-1'],
      p_merge_group_id: null,
    });
    expect(result).toBe(true);
  });

  it('falls back to legacy RPC when flags disabled', async () => {
    featureFlagsSpy?.mockReturnValue({
      ...env.featureFlags,
      assignAtomic: false,
      rpcAssignAtomic: false,
      allocationsDualWrite: false,
    });

    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    const client = {
      rpc,
    } as unknown as Parameters<UnassignTableFn>[2];

    const result = await unassignTableFromBooking('booking-1', 'table-1', client);

    expect(rpc).toHaveBeenCalledWith('unassign_table_from_booking', {
      p_booking_id: 'booking-1',
      p_table_id: 'table-1',
    });
    expect(result).toBe(true);
  });
});
