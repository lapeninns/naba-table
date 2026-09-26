import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/posthog/server', () => ({
  captureServerException: vi.fn(),
}));

import {
  persistLifecycleTransition,
  persistUndoNoShowTransition,
} from '@/src/app/api/ops/bookings/[id]/_shared/lifecycleRoute';

import type { TransitionResult } from '@/server/ops/booking-lifecycle/actions';

const BOOKING = {
  id: 'booking-1',
  restaurant_id: 'restaurant-1',
  status: 'confirmed' as const,
  checked_in_at: null,
  checked_out_at: null,
  booking_date: '2026-05-16',
  start_time: '19:00',
  end_time: '20:30',
};

const NOW = '2026-05-16T19:01:00.000Z';

const CHECK_IN: TransitionResult = {
  skipUpdate: false,
  updates: { status: 'checked_in', checked_in_at: NOW, checked_out_at: null, updated_at: NOW },
  history: {
    booking_id: BOOKING.id,
    from_status: 'confirmed',
    to_status: 'checked_in',
    changed_by: 'user-1',
    changed_at: NOW,
    reason: null,
    metadata: { action: 'check-in' },
  },
  response: { status: 'checked_in', checkedInAt: NOW, checkedOutAt: null, updatedAt: NOW },
};

const UNDO: TransitionResult = {
  skipUpdate: false,
  updates: { status: 'confirmed', checked_in_at: null, checked_out_at: null, updated_at: NOW },
  history: {
    booking_id: BOOKING.id,
    from_status: 'no_show',
    to_status: 'confirmed',
    changed_by: 'user-1',
    changed_at: NOW,
    reason: 'arrived late',
    metadata: { action: 'undo-no-show' },
  },
  response: { status: 'confirmed', checkedInAt: null, checkedOutAt: null, updatedAt: NOW },
};

function makeService(options: {
  rpcResult: { data: unknown; error: unknown };
  currentStatus?: string | null;
}) {
  const statusQuery = {
    select: vi.fn(() => statusQuery),
    eq: vi.fn(() => statusQuery),
    maybeSingle: vi.fn(async () => ({
      data:
        options.currentStatus === null ? null : { status: options.currentStatus ?? 'confirmed' },
      error: null,
    })),
  };
  const rpc = vi.fn(async () => options.rpcResult);
  const from = vi.fn(() => statusQuery);
  return { client: { rpc, from } as never, rpc, from };
}

describe('lifecycle persistence error mapping (C1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps a lost compare-and-set (P0004 booking_state_conflict) to 409 with the current status', async () => {
    const { client, from } = makeService({
      rpcResult: {
        data: null,
        error: {
          code: 'P0004',
          message: 'booking_state_conflict',
          details: 'Current status no_show does not match expected confirmed',
        },
      },
      currentStatus: 'no_show',
    });

    const result = await persistLifecycleTransition({
      booking: BOOKING,
      transition: CHECK_IN,
      serviceSupabase: client,
      logLabel: 'booking-check-in',
    });

    expect(result.response?.status).toBe(409);
    const body = await result.response?.json();
    expect(body).toEqual({
      error: expect.any(String),
      message: expect.any(String),
      code: 'BOOKING_STATE_CONFLICT',
      retryable: false,
      details: { currentStatus: 'no_show' },
    });
    // The DB DETAIL text never reaches the client.
    expect(JSON.stringify(body)).not.toContain('does not match');
    expect(from).toHaveBeenCalledWith('bookings');
  });

  it('reports currentStatus null when the status cannot be re-read', async () => {
    const { client } = makeService({
      rpcResult: { data: null, error: { code: 'P0004', message: 'booking_state_conflict' } },
      currentStatus: null,
    });

    const result = await persistLifecycleTransition({
      booking: BOOKING,
      transition: CHECK_IN,
      serviceSupabase: client,
      logLabel: 'booking-check-in',
    });

    expect(result.response?.status).toBe(409);
    await expect(result.response?.json()).resolves.toMatchObject({
      details: { currentStatus: null },
    });
  });

  it('maps a vanished booking (P0002) to 404 BOOKING_NOT_FOUND', async () => {
    const { client } = makeService({
      rpcResult: { data: null, error: { code: 'P0002', message: 'Booking booking-1 not found' } },
    });

    const result = await persistLifecycleTransition({
      booking: BOOKING,
      transition: CHECK_IN,
      serviceSupabase: client,
      logLabel: 'booking-check-in',
    });

    expect(result.response?.status).toBe(404);
    await expect(result.response?.json()).resolves.toMatchObject({ code: 'BOOKING_NOT_FOUND' });
  });

  it('maps any other failure to a generic 500 without database text', async () => {
    const { client } = makeService({
      rpcResult: {
        data: null,
        error: { code: '40P01', message: 'deadlock detected', hint: 'retry the transaction' },
      },
    });

    const result = await persistLifecycleTransition({
      booking: BOOKING,
      transition: CHECK_IN,
      serviceSupabase: client,
      logLabel: 'booking-check-in',
    });

    expect(result.response?.status).toBe(500);
    const body = await result.response?.json();
    expect(body.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(body)).not.toMatch(/deadlock|retry the transaction/);
  });

  it('calls undo_booking_no_show with the source history id and returns the restoration', async () => {
    const { client, rpc } = makeService({
      rpcResult: {
        data: [
          {
            status: 'confirmed',
            checked_in_at: null,
            checked_out_at: null,
            updated_at: '2026-05-16T19:01:02.000Z',
            table_restoration: 'restored',
            released_table_ids: ['table-1'],
          },
        ],
        error: null,
      },
    });

    const result = await persistUndoNoShowTransition({
      booking: { ...BOOKING, status: 'no_show' },
      transition: UNDO,
      sourceHistoryId: 42,
      serviceSupabase: client,
      logLabel: 'booking-undo-no-show',
    });

    expect(result.result).toEqual({
      status: 'confirmed',
      checkedInAt: null,
      checkedOutAt: null,
      updatedAt: '2026-05-16T19:01:02.000Z',
      changed: true,
      tableRestoration: { status: 'restored', tableIds: ['table-1'] },
    });
    expect(rpc).toHaveBeenCalledWith('undo_booking_no_show', {
      p_booking_id: BOOKING.id,
      p_restaurant_id: BOOKING.restaurant_id,
      p_source_history_id: 42,
      p_status: 'confirmed',
      p_checked_in_at: null,
      p_checked_out_at: null,
      p_updated_at: NOW,
      p_history_changed_by: 'user-1',
      p_history_changed_at: NOW,
      p_history_reason: 'arrived late',
      p_history_metadata: { action: 'undo-no-show' },
    });
  });

  it('maps a concurrent second undo (lost compare-and-set) to 409', async () => {
    const { client } = makeService({
      rpcResult: { data: null, error: { code: 'P0004', message: 'booking_state_conflict' } },
      currentStatus: 'confirmed',
    });

    const result = await persistUndoNoShowTransition({
      booking: { ...BOOKING, status: 'no_show' },
      transition: UNDO,
      sourceHistoryId: 42,
      serviceSupabase: client,
      logLabel: 'booking-undo-no-show',
    });

    expect(result.response?.status).toBe(409);
    await expect(result.response?.json()).resolves.toMatchObject({
      code: 'BOOKING_STATE_CONFLICT',
      details: { currentStatus: 'confirmed' },
    });
  });

  it('maps a stale history id to 400 NO_SHOW_HISTORY_MISSING', async () => {
    const { client } = makeService({
      rpcResult: { data: null, error: { code: 'P0002', message: 'no_show_history_missing' } },
    });

    const result = await persistUndoNoShowTransition({
      booking: { ...BOOKING, status: 'no_show' },
      transition: UNDO,
      sourceHistoryId: 42,
      serviceSupabase: client,
      logLabel: 'booking-undo-no-show',
    });

    expect(result.response?.status).toBe(400);
    await expect(result.response?.json()).resolves.toMatchObject({
      code: 'NO_SHOW_HISTORY_MISSING',
    });
  });

  it('degrades an unknown restoration value to unknown with no table ids', async () => {
    const { client } = makeService({
      rpcResult: {
        data: [
          {
            status: 'confirmed',
            checked_in_at: null,
            checked_out_at: null,
            updated_at: NOW,
            table_restoration: 'something-new',
            released_table_ids: ['table-1'],
          },
        ],
        error: null,
      },
    });

    const result = await persistUndoNoShowTransition({
      booking: { ...BOOKING, status: 'no_show' },
      transition: UNDO,
      sourceHistoryId: 42,
      serviceSupabase: client,
      logLabel: 'booking-undo-no-show',
    });

    expect(result.result?.tableRestoration).toEqual({ status: 'unknown', tableIds: [] });
  });
});
