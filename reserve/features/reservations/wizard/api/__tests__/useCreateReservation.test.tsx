import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCreateReservation } from '../useCreateReservation';

import type { ReservationDraft } from '../../model/reducer';

const trackMock = vi.hoisted(() => vi.fn());
const emitMock = vi.hoisted(() => vi.fn());
const postMock = vi.hoisted(() => vi.fn());
const putMock = vi.hoisted(() => vi.fn());

vi.mock('@shared/lib/analytics', () => ({
  track: (...args: unknown[]) => trackMock(...(args as Parameters<typeof trackMock>)),
}));

vi.mock('@/lib/analytics/emit', () => ({
  emit: (...args: unknown[]) => emitMock(...(args as Parameters<typeof emitMock>)),
}));

vi.mock('@shared/api/client', () => ({
  apiClient: {
    post: (...args: unknown[]) => postMock(...args),
    put: (...args: unknown[]) => putMock(...args),
    get: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const draft: ReservationDraft = {
  restaurantId: 'restaurant-1',
  date: '2025-05-20',
  time: '18:00',
  party: 2,
  bookingType: 'dinner',
  seating: 'indoor',
  notes: 'Near window',
  name: 'Test Guest',
  email: 'guest@example.com',
  phone: '07123 456789',
  marketingOptIn: true,
};

describe('useCreateReservation', () => {
  const originalCrypto = globalThis.crypto;

  beforeAll(() => {
    let invocation = 0;
    vi.stubGlobal('crypto', {
      randomUUID: () => {
        invocation += 1;
        return invocation === 1 ? 'idempotency-key-1' : `idempotency-key-${invocation}`;
      },
    });
  });

  afterAll(() => {
    vi.stubGlobal('crypto', originalCrypto);
  });

  beforeEach(() => {
    trackMock.mockReset();
    emitMock.mockReset();
    postMock.mockReset();
    putMock.mockReset();
  });

  function renderUseCreateReservation() {
    const queryClient = new QueryClient();
    function wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    }
    return renderHook(() => useCreateReservation(), { wrapper });
  }

  it('tracks failure analytics and resets idempotency key on error', async () => {
    postMock.mockRejectedValueOnce({
      code: 'SERVER_ERROR',
      message: 'Server exploded',
      status: 500,
    });
    postMock.mockRejectedValueOnce({
      code: 'SERVER_ERROR',
      message: 'Server exploded again',
      status: 500,
    });

    const { result } = renderUseCreateReservation();

    let firstError: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync({ draft });
      } catch (error) {
        firstError = error;
      }
    });

    expect(firstError).toMatchObject({ code: 'SERVER_ERROR' });
    expect(trackMock).toHaveBeenCalledWith(
      'wizard_submit_failed',
      expect.objectContaining({
        code: 'SERVER_ERROR',
        status: 500,
      }),
    );
    expect(emitMock).toHaveBeenCalledWith(
      'wizard_submit_failed',
      expect.objectContaining({
        code: 'SERVER_ERROR',
        status: 500,
      }),
    );

    const firstHeaders = postMock.mock.calls[0]?.[2]?.headers as Record<string, string> | undefined;
    expect(firstHeaders?.['Idempotency-Key']).toBe('idempotency-key-1');

    let secondError: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync({ draft });
      } catch (error) {
        secondError = error;
      }
    });
    expect(secondError).toMatchObject({ code: 'SERVER_ERROR' });

    const secondHeaders = postMock.mock.calls[1]?.[2]?.headers as
      | Record<string, string>
      | undefined;
    expect(secondHeaders?.['Idempotency-Key']).toBe('idempotency-key-2');
  });

  it('includes restaurantSlug in the payload when provided', async () => {
    postMock.mockResolvedValueOnce({});
    const { result } = renderUseCreateReservation();

    await act(async () => {
      await result.current.mutateAsync({ draft: { ...draft, restaurantSlug: 'white-horse' } });
    });

    expect(postMock).toHaveBeenCalledWith(
      '/bookings',
      expect.objectContaining({ restaurantSlug: 'white-horse' }),
      expect.any(Object),
    );
  });
});
