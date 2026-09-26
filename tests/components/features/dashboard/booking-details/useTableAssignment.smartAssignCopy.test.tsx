import { act, renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useTableAssignment } from '@/components/features/dashboard/booking-details/hooks/useTableAssignment';

const bookingService = vi.hoisted(() => ({
  getAssignmentContext: vi.fn(),
  autoQuoteTables: vi.fn(),
  confirmHoldAssignment: vi.fn(),
}));

vi.mock('@/contexts/ops-services', () => ({ useBookingService: () => bookingService }));

const SERVER_REASON = 'relation "table_holds" violates constraint holds_excl at 18:00';

function setup() {
  const queryClient = createTestQueryClient();
  return renderHook(
    () =>
      useTableAssignment({
        bookingId: 'b1',
        restaurantId: 'rest-1',
        partySize: 2,
        realtime: false,
      }),
    { wrapper: createQueryWrapper(queryClient) },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  bookingService.getAssignmentContext.mockResolvedValue({
    booking: { id: 'b1', status: 'confirmed' },
    tables: [],
    bookingAssignments: [],
    holds: [],
    conflicts: [],
  });
});

describe('useTableAssignment smart-assign copy', () => {
  it('@contract shows fixed copy, not the server reason, when no candidate is found', async () => {
    bookingService.autoQuoteTables.mockResolvedValue({ candidate: null, reason: SERVER_REASON });
    const { result } = setup();
    await waitFor(() => expect(bookingService.getAssignmentContext).toHaveBeenCalled());

    let outcome: { ok: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.autoAssign();
    });

    expect(outcome).toEqual({ ok: false, error: 'No suitable tables found for this booking.' });
    expect(outcome?.error).not.toContain('table_holds');
  });

  it('@contract shows fixed copy when the quoted tables could not be held', async () => {
    bookingService.autoQuoteTables.mockResolvedValue({
      candidate: { tableIds: ['t1'] },
      holdId: null,
      reason: SERVER_REASON,
    });
    const { result } = setup();
    await waitFor(() => expect(bookingService.getAssignmentContext).toHaveBeenCalled());

    let outcome: { ok: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.autoAssign();
    });

    expect(outcome).toEqual({
      ok: false,
      error: 'Smart assign could not reserve the suggested tables. Try again.',
    });
    expect(bookingService.confirmHoldAssignment).not.toHaveBeenCalled();
  });

  it('@contract never shows raw text from an unexpected client error', async () => {
    bookingService.autoQuoteTables.mockRejectedValue(new Error(SERVER_REASON));
    const { result } = setup();
    await waitFor(() => expect(bookingService.getAssignmentContext).toHaveBeenCalled());

    let outcome: { ok: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.autoAssign();
    });

    expect(outcome).toEqual({ ok: false, error: 'Auto-assign failed.' });
  });
});
