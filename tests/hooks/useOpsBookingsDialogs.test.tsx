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
  cancel: vi.fn(),
  isPending: false,
}));

vi.mock('@src/hooks/ops/useOpsBooking', () => ({
  useOpsBooking: (bookingId: string | null) => opsBookingHook.fn(bookingId),
}));

// The real cancel controller runs on top of a mocked cancel mutation.
vi.mock('@src/hooks/ops/useOpsCancelBooking', () => ({
  useOpsCancelBooking: () => ({
    cancel: cancelMutation.cancel,
    isPending: (id: string | null | undefined) => Boolean(id) && cancelMutation.isPending,
  }),
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
    cancelMutation.cancel.mockResolvedValue({
      status: 'done',
      result: { id: 'b-1', status: 'cancelled' },
    });
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
    expect(cancelMutation.cancel).not.toHaveBeenCalled();

    const orphan = setup({ activeRestaurantId: null });
    act(() => orphan.result.current.onCancelRequest(makeBooking({ restaurantId: null })));
    await act(async () => orphan.result.current.onConfirmCancel());

    expect(cancelMutation.cancel).not.toHaveBeenCalled();
    expect(orphan.result.current.isCancelOpen).toBe(true);
  });

  it('@contract cancels the booking in its own restaurant and closes on success', async () => {
    const { result } = setup();

    act(() => result.current.onCancelRequest(makeBooking()));
    await act(async () => result.current.onConfirmCancel());

    expect(cancelMutation.cancel).toHaveBeenCalledWith({ bookingId: 'b-1', restaurantId: 'rest-9' });
    expect(result.current.isCancelOpen).toBe(false);
    expect(result.current.cancelBooking).toBeNull();
  });

  it('@contract falls back to the active restaurant when the booking has none', async () => {
    const { result } = setup();

    act(() => result.current.onCancelRequest(makeBooking({ restaurantId: null })));
    await act(async () => result.current.onConfirmCancel());

    expect(cancelMutation.cancel).toHaveBeenCalledWith({ bookingId: 'b-1', restaurantId: 'rest-1' });
  });

  it('@contract keeps the cancel dialog open when the cancellation fails', async () => {
    cancelMutation.cancel.mockResolvedValue({ status: 'failed', error: new Error('too late') });
    const { result } = setup();

    act(() => result.current.onCancelRequest(makeBooking()));
    await act(async () => {
      await expect(result.current.onConfirmCancel()).resolves.toBeUndefined();
    });

    expect(result.current.isCancelOpen).toBe(true);
    expect(result.current.cancelBooking?.id).toBe('b-1');
  });

  it('@contract isCancelling mirrors the pending state of the booking being cancelled', () => {
    cancelMutation.isPending = true;
    const { result } = setup();

    expect(result.current.isCancelling).toBe(false);
    act(() => result.current.onCancelRequest(makeBooking()));
    expect(result.current.isCancelling).toBe(true);
  });
});
