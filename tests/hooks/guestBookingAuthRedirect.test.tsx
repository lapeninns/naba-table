import { renderHook } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCancelBooking } from '@/hooks/useCancelBooking';
import { useUpdateBooking } from '@/hooks/useUpdateBooking';
import { isGuestBookingLinkPath } from '@/lib/http/sessionRedirect';
import { useReservation } from '@features/reservations/wizard/api/useReservation';
import { apiClient } from '@shared/api/client';

import type * as SessionRedirect from '@/lib/http/sessionRedirect';

type SessionRedirectModule = typeof SessionRedirect;

// Real fetchJson; only the navigation side effect is observed.
const triggerSessionRedirectMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/http/sessionRedirect', async (importOriginal) => {
  const actual = await importOriginal<SessionRedirectModule>();
  return { ...actual, triggerSessionRedirect: triggerSessionRedirectMock };
});
vi.mock('@/lib/analytics', () => ({ track: vi.fn() }));
vi.mock('@/lib/analytics/emit', () => ({ emit: vi.fn() }));

function stub401(code: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify({ code, message: 'Sign in again.', error: 'Sign in again.' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
    ),
  );
}

async function flushDynamicImport() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('guest booking hooks and the sign-in redirect', () => {
  beforeEach(() => {
    triggerSessionRedirectMock.mockClear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.pushState({}, '', '/');
  });

  it('treats only the public /bookings pages as guest link surfaces', () => {
    expect(isGuestBookingLinkPath('/bookings/b-1')).toBe(true);
    expect(isGuestBookingLinkPath('/bookings')).toBe(true);
    expect(isGuestBookingLinkPath('/bookings/find')).toBe(true);
    expect(isGuestBookingLinkPath('/app/bookings')).toBe(false);
    expect(isGuestBookingLinkPath('/guest/bookings')).toBe(false);
    expect(isGuestBookingLinkPath('/bookingsx')).toBe(false);
  });

  it('treats the cookie-reachable /guest/bookings/<id> detail and receipt pages as guest link surfaces', () => {
    expect(isGuestBookingLinkPath('/guest/bookings/b-1')).toBe(true);
    expect(isGuestBookingLinkPath('/guest/bookings/b-1/')).toBe(true);
    expect(isGuestBookingLinkPath('/guest/bookings/b-1/receipt')).toBe(true);
    expect(isGuestBookingLinkPath('/guest/bookings/')).toBe(false);
    expect(isGuestBookingLinkPath('/guest/bookings/b-1/edit')).toBe(false);
    expect(isGuestBookingLinkPath('/guest/bookings/b-1/receipt/x')).toBe(false);
    expect(isGuestBookingLinkPath('/guest/profile')).toBe(false);
  });

  it('cancel on the guest booking page surfaces UNAUTHENTICATED without redirecting to sign-in', async () => {
    window.history.pushState({}, '', '/bookings/b-1');
    stub401('UNAUTHENTICATED');
    const { result } = renderHook(() => useCancelBooking(), {
      wrapper: createQueryWrapper(createTestQueryClient()),
    });
    await expect(result.current.mutateAsync({ id: 'b-1' })).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
      status: 401,
    });
    await flushDynamicImport();
    expect(triggerSessionRedirectMock).not.toHaveBeenCalled();
  });

  it('update on the guest booking page surfaces INVALID_ACCESS_TOKEN without redirecting', async () => {
    window.history.pushState({}, '', '/bookings/b-1');
    stub401('INVALID_ACCESS_TOKEN');
    const { result } = renderHook(() => useUpdateBooking(), {
      wrapper: createQueryWrapper(createTestQueryClient()),
    });
    await expect(
      result.current.mutateAsync({ id: 'b-1', startIso: '2026-10-01T19:00:00Z', partySize: 2 }),
    ).rejects.toMatchObject({ code: 'INVALID_ACCESS_TOKEN', status: 401 });
    await flushDynamicImport();
    expect(triggerSessionRedirectMock).not.toHaveBeenCalled();
  });

  it('keeps the sign-in redirect for the same hook on an ops page', async () => {
    window.history.pushState({}, '', '/app/bookings');
    stub401('UNAUTHENTICATED');
    const { result } = renderHook(() => useCancelBooking(), {
      wrapper: createQueryWrapper(createTestQueryClient()),
    });
    await expect(result.current.mutateAsync({ id: 'b-1' })).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
    await vi.waitFor(() => expect(triggerSessionRedirectMock).toHaveBeenCalledTimes(1));
  });

  it('does not redirect when the active reservation detail refetch also gets a 401 on the guest page', async () => {
    window.history.pushState({}, '', '/bookings/b-1');
    stub401('INVALID_ACCESS_TOKEN');
    const wrapper = createQueryWrapper(createTestQueryClient());
    const { result } = renderHook(
      () => ({ cancel: useCancelBooking(), reservation: useReservation('b-1') }),
      { wrapper },
    );
    await vi.waitFor(() => expect(result.current.reservation.isError).toBe(true));
    await expect(result.current.cancel.mutateAsync({ id: 'b-1' })).rejects.toMatchObject({
      code: 'INVALID_ACCESS_TOKEN',
      status: 401,
    });
    // onSettled invalidates reservationKeys.detail(id); the active query refetches.
    await vi.waitFor(() => {
      const fetchMock = vi.mocked(globalThis.fetch);
      const gets = fetchMock.mock.calls.filter(
        ([, init]) => (init as RequestInit | undefined)?.method === 'GET',
      );
      expect(gets.length).toBeGreaterThanOrEqual(2);
    });
    await flushDynamicImport();
    expect(triggerSessionRedirectMock).not.toHaveBeenCalled();
  });

  it('keeps the reserve client sign-in redirect off the guest booking pages', async () => {
    window.history.pushState({}, '', '/app/bookings');
    stub401('UNAUTHENTICATED');
    await expect(apiClient.get('/bookings/b-1')).rejects.toMatchObject({ status: 401 });
    await vi.waitFor(() => expect(triggerSessionRedirectMock).toHaveBeenCalledTimes(1));
  });
});
