import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useOpsBookingsDialogs, type UseOpsBookingsDialogsParams } from '@src/hooks/ops/useOpsBookingsDialogs';

import type { BookingDTO } from '@/hooks/useBookings';
import type { OpsBookingListItem } from '@/types/ops';

// Seams: the two data hooks this hook composes. Both already have their own
// behavioral suites, so they are mocked at the module boundary here and no
// QueryClientProvider is needed.
const opsBookingHook = vi.hoisted(() => ({
  fn: vi.fn<(bookingId: string | null) => { data: OpsBookingListItem | undefined }>(),
}));

const cancelMutation = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
}));

vi.mock('@/hooks/ops/useOpsBooking', () => ({
  useOpsBooking: (bookingId: string | null) => opsBookingHook.fn(bookingId),
}));

vi.mock('@/hooks/ops/useOpsCancelBooking', () => ({
  useOpsCancelBooking: () => cancelMutation,
}));

function makeBooking(overrides: Partial<BookingDTO> = {}): BookingDTO {
  return {
    id: 'b-1',
    restaurantId: 'rest-9',
    restaurantName: 'Cafe Nine',
    restaurantSlug: 'cafe-nine',
    restaurantTimezone: 'Europe/London',
    partySize: 2,
    startIso: '2026-07-12T18:00:00.000Z',
    endIso: '2026-07-12T20:00:00.000Z',
    status: 'confirmed',
    ...overrides,
  } as BookingDTO;
}

function setup(overrides: Partial<UseOpsBookingsDialogsParams> = {}) {
  const params: UseOpsBookingsDialogsParams = {
    bookingById: new Map(),
    focusBookingId: null,
    activeRestaurantId: 'rest-1',
    restaurantTimezone: 'Europe/London',
    appliedDate: null,
    fallbackRestaurantSlug: 'fallback-slug',
    clearFocusParam: vi.fn(),
    ...overrides,
  };
  return {
    params,
    ...renderHook((props: UseOpsBookingsDialogsParams) => useOpsBookingsDialogs(props), {
      initialProps: params,
    }),
  };
}

describe('useOpsBookingsDialogs', () => {
  beforeEach(() => {
    opsBookingHook.fn.mockReturnValue({ data: undefined });
    cancelMutation.mutateAsync.mockResolvedValue({ id: 'b-1', status: 'cancelled' });
    cancelMutation.isPending = false;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('@contract starts with every dialog closed and no focus fetch', () => {
    const { result } = setup();

    expect(result.current.detailsBooking).toBeNull();
    expect(result.current.isDetailsOpen).toBe(false);
    expect(result.current.editBooking).toBeNull();
    expect(result.current.isEditOpen).toBe(false);
    expect(result.current.cancelBooking).toBeNull();
    expect(result.current.isCancelOpen).toBe(false);
    expect(result.current.isCancelling).toBe(false);
    expect(opsBookingHook.fn).toHaveBeenCalledWith(null);
  });

  it('@contract onDetails and onEdit are mutually exclusive dialogs', () => {
    const first = makeBooking({ id: 'b-1' });
    const second = makeBooking({ id: 'b-2' });
    const { result } = setup();

    act(() => result.current.onEdit(first));
    expect(result.current.isEditOpen).toBe(true);
    expect(result.current.editBooking).toEqual(first);

    act(() => result.current.onDetails(second));
    expect(result.current.isDetailsOpen).toBe(true);
    expect(result.current.detailsBooking).toEqual(second);
    expect(result.current.isEditOpen).toBe(false);
    expect(result.current.editBooking).toBeNull();

    act(() => result.current.onEdit(first));
    expect(result.current.isEditOpen).toBe(true);
    expect(result.current.isDetailsOpen).toBe(false);
    expect(result.current.detailsBooking).toBeNull();
  });

  it('@contract closing details clears the booking and only clears the focus param when focused', () => {
    const booking = makeBooking();
    const noFocus = setup();

    act(() => noFocus.result.current.onDetails(booking));
    act(() => noFocus.result.current.onDetailsOpenChange(false));

    expect(noFocus.result.current.isDetailsOpen).toBe(false);
    expect(noFocus.result.current.detailsBooking).toBeNull();
    expect(noFocus.params.clearFocusParam).not.toHaveBeenCalled();

    const focused = setup({
      focusBookingId: 'b-1',
      bookingById: new Map([['b-1', booking]]),
    });

    act(() => focused.result.current.onDetailsOpenChange(false));
    expect(focused.params.clearFocusParam).toHaveBeenCalledTimes(1);
  });

  it('@contract closing edit clears the edit booking', () => {
    const booking = makeBooking();
    const { result } = setup();

    act(() => result.current.onEdit(booking));
    act(() => result.current.onEditOpenChange(false));

    expect(result.current.isEditOpen).toBe(false);
    expect(result.current.editBooking).toBeNull();
  });

  it('@contract auto-opens details for a focused booking already in the list without fetching', () => {
    vi.useFakeTimers();
    const booking = makeBooking({ id: 'b-1' });
    const row = document.createElement('div');
    row.setAttribute('data-booking-id', 'b-1');
    document.body.appendChild(row);
    const scrollSpy = vi.spyOn(row, 'scrollIntoView');

    const { result } = setup({
      focusBookingId: 'b-1',
      bookingById: new Map([['b-1', booking]]),
    });

    expect(result.current.isDetailsOpen).toBe(true);
    expect(result.current.detailsBooking).toEqual(booking);
    expect(opsBookingHook.fn).toHaveBeenLastCalledWith(null);

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(scrollSpy).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' });

    row.remove();
  });

  it('@contract fetches a focused booking missing from the list and maps it with the fallback slug', () => {
    opsBookingHook.fn.mockReturnValue({
      data: {
        id: 'b-7',
        restaurantId: 'rest-7',
        restaurantName: 'Cafe Seven',
        restaurantSlug: null,
        restaurantTimezone: null,
        partySize: 4,
        startIso: '2026-07-13T18:00:00.000Z',
        endIso: '2026-07-13T20:00:00.000Z',
        status: 'confirmed',
      } as unknown as OpsBookingListItem,
    });

    const { result } = setup({ focusBookingId: 'b-7' });

    expect(opsBookingHook.fn).toHaveBeenLastCalledWith('b-7');
    expect(result.current.isDetailsOpen).toBe(true);
    expect(result.current.detailsBooking).toMatchObject({
      id: 'b-7',
      restaurantId: 'rest-7',
      restaurantSlug: 'fallback-slug',
      restaurantTimezone: null,
      partySize: 4,
    });
  });

  it('@contract onCancelRequest opens the cancel dialog and closing it clears the target', () => {
    const booking = makeBooking();
    const { result } = setup();

    act(() => result.current.onCancelRequest(booking));
    expect(result.current.isCancelOpen).toBe(true);
    expect(result.current.cancelBooking).toEqual(booking);

    act(() => result.current.onCancelOpenChange(false));
    expect(result.current.isCancelOpen).toBe(false);
    expect(result.current.cancelBooking).toBeNull();
  });

  it('@contract onConfirmCancel is a no-op without a cancel target or resolvable restaurant', async () => {
    const { result } = setup();
    await act(async () => result.current.onConfirmCancel());
    expect(cancelMutation.mutateAsync).not.toHaveBeenCalled();

    const orphan = setup({ activeRestaurantId: null });
    act(() =>
      orphan.result.current.onCancelRequest(makeBooking({ restaurantId: null })),
    );
    await act(async () => orphan.result.current.onConfirmCancel());

    expect(cancelMutation.mutateAsync).not.toHaveBeenCalled();
    expect(orphan.result.current.isCancelOpen).toBe(true);
  });

  it('@contract cancels on the booking start date resolved in the booking timezone', async () => {
    const { result } = setup();

    // 02:30 UTC is still 2026-07-11 in New York (-04:00 in July).
    act(() =>
      result.current.onCancelRequest(
        makeBooking({
          startIso: '2026-07-12T02:30:00.000Z',
          restaurantTimezone: 'America/New_York',
        }),
      ),
    );
    await act(async () => result.current.onConfirmCancel());

    expect(cancelMutation.mutateAsync).toHaveBeenNthCalledWith(1, {
      bookingId: 'b-1',
      restaurantId: 'rest-9',
      targetDate: '2026-07-11',
    });
    expect(result.current.isCancelOpen).toBe(false);
    expect(result.current.cancelBooking).toBeNull();

    // The same instant is already 2026-07-12 in Kathmandu (+05:45).
    act(() =>
      result.current.onCancelRequest(
        makeBooking({
          startIso: '2026-07-12T02:30:00.000Z',
          restaurantTimezone: 'Asia/Kathmandu',
        }),
      ),
    );
    await act(async () => result.current.onConfirmCancel());

    expect(cancelMutation.mutateAsync).toHaveBeenNthCalledWith(2, {
      bookingId: 'b-1',
      restaurantId: 'rest-9',
      targetDate: '2026-07-12',
    });
  });

  it('@contract falls back to the applied date and active restaurant when the start is invalid', async () => {
    const { result } = setup({ appliedDate: '2026-07-15' });

    act(() =>
      result.current.onCancelRequest(
        makeBooking({ startIso: 'not-a-date', restaurantId: null, restaurantTimezone: null }),
      ),
    );
    await act(async () => result.current.onConfirmCancel());

    expect(cancelMutation.mutateAsync).toHaveBeenCalledWith({
      bookingId: 'b-1',
      restaurantId: 'rest-1',
      targetDate: '2026-07-15',
    });
  });

  it('@contract falls back to today in the restaurant timezone without a start or applied date', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-11T23:30:00.000Z'));

    const { result } = setup({ restaurantTimezone: 'Australia/Sydney' });

    act(() =>
      result.current.onCancelRequest(
        makeBooking({ startIso: '', restaurantTimezone: null }),
      ),
    );
    await act(async () => result.current.onConfirmCancel());

    // 23:30 UTC on the 11th is already 2026-07-12 in Sydney (+10:00 in July).
    expect(cancelMutation.mutateAsync).toHaveBeenCalledWith({
      bookingId: 'b-1',
      restaurantId: 'rest-9',
      targetDate: '2026-07-12',
    });
  });

  it('@contract closes the cancel dialog even when the cancellation fails', async () => {
    cancelMutation.mutateAsync.mockRejectedValue(new Error('too late'));
    const { result } = setup();

    act(() => result.current.onCancelRequest(makeBooking()));

    await act(async () => {
      await expect(result.current.onConfirmCancel()).rejects.toThrow('too late');
    });

    expect(result.current.isCancelOpen).toBe(false);
    expect(result.current.cancelBooking).toBeNull();
  });

  it('@contract isCancelling mirrors the mutation pending state', () => {
    cancelMutation.isPending = true;
    const { result } = setup();

    expect(result.current.isCancelling).toBe(true);
  });
});
