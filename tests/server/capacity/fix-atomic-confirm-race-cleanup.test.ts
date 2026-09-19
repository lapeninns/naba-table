import { createClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/observability', () => ({ recordObservabilityEvent: vi.fn() }));
vi.mock('@/server/capacity/table-assignment/booking-state', () => ({
  fetchBookingAssignmentState: vi.fn(),
  reconcileOrphanedAssignments: vi.fn(),
}));
vi.mock('@/server/capacity/table-assignment/policy-retry', () => ({
  confirmWithPolicyRetry: vi.fn(),
}));
vi.mock('@/server/capacity/table-assignment/supabase', async (importOriginal) => {
  const actual = await importOriginal<typeof SupabaseHelpers>();
  return { ...actual, releaseHoldWithRetry: vi.fn() };
});

import { atomicConfirmAndTransition } from '@/server/capacity/table-assignment/assignment';
import {
  fetchBookingAssignmentState,
  reconcileOrphanedAssignments,
} from '@/server/capacity/table-assignment/booking-state';
import { confirmWithPolicyRetry } from '@/server/capacity/table-assignment/policy-retry';
import { releaseHoldWithRetry } from '@/server/capacity/table-assignment/supabase';
import { recordObservabilityEvent } from '@/server/observability';

import type * as SupabaseHelpers from '@/server/capacity/table-assignment/supabase';
import type { Database } from '@/types/supabase';

const client = createClient<Database>('http://127.0.0.1:54321', 'test-key', {
  auth: { persistSession: false, autoRefreshToken: false },
});
const options = {
  bookingId: 'booking-1',
  holdId: 'losing-hold',
  idempotencyKey: 'shared-key',
  historyReason: 'auto_assign',
  client,
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(recordObservabilityEvent).mockResolvedValue(undefined);
  vi.mocked(releaseHoldWithRetry).mockResolvedValue(undefined);
  vi.mocked(fetchBookingAssignmentState).mockResolvedValue({
    bookingState: 'confirmed',
    assignmentCount: 1,
    restaurantId: 'restaurant-1',
  });
});

describe('atomic confirmation preserves winning allocations on ambiguous errors', () => {
  it('releases only the losing hold when a concurrent confirmer wins', async () => {
    const failure = new Error('Idempotency payload mismatch');
    vi.mocked(confirmWithPolicyRetry).mockRejectedValue(failure);
    await expect(atomicConfirmAndTransition(options)).rejects.toBe(failure);
    expect(reconcileOrphanedAssignments).not.toHaveBeenCalled();
    expect(releaseHoldWithRetry).toHaveBeenCalledWith({ holdId: 'losing-hold', client });
  });

  it('preserves committed allocations when the post-commit read is aborted', async () => {
    const controller = new AbortController();
    vi.mocked(confirmWithPolicyRetry).mockImplementation(async () => {
      controller.abort();
      return { assignments: [], attempts: 1 };
    });
    vi.mocked(fetchBookingAssignmentState)
      .mockResolvedValueOnce({
        bookingState: 'confirmed',
        assignmentCount: 0,
        restaurantId: 'restaurant-1',
      })
      .mockResolvedValueOnce({ bookingState: null, assignmentCount: 0, restaurantId: null });
    await expect(
      atomicConfirmAndTransition({ ...options, signal: controller.signal }),
    ).rejects.toMatchObject({
      code: 'STATE_RECONCILIATION_FAILED',
    });
    expect(reconcileOrphanedAssignments).not.toHaveBeenCalled();
    expect(releaseHoldWithRetry).toHaveBeenCalledWith({ holdId: 'losing-hold', client });
  });

  it('keeps the original failure if releasing the failed hold also fails', async () => {
    const failure = new Error('confirmation timed out');
    vi.mocked(confirmWithPolicyRetry).mockRejectedValue(failure);
    vi.mocked(releaseHoldWithRetry).mockRejectedValue(new Error('release unavailable'));
    await expect(atomicConfirmAndTransition(options)).rejects.toBe(failure);
    expect(reconcileOrphanedAssignments).not.toHaveBeenCalled();
  });
  it('preserves the original failure when cleanup telemetry is unavailable', async () => {
    const failure = new Error('confirmation timed out');
    vi.mocked(confirmWithPolicyRetry).mockRejectedValue(failure);
    vi.mocked(releaseHoldWithRetry).mockRejectedValue(new Error('release unavailable'));
    vi.mocked(recordObservabilityEvent).mockRejectedValue(new Error('telemetry unavailable'));
    await expect(atomicConfirmAndTransition(options)).rejects.toBe(failure);
    expect(reconcileOrphanedAssignments).not.toHaveBeenCalled();
  });
});
