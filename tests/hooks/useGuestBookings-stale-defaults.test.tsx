import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useGuestBookings } from '@/guest/hooks/useGuestBookings';
import { GuestServicesProvider } from '@/guest/services/di';
import { createAppQueryClient } from '@/lib/query/client';

import type { AuthPort, BookingsPage, BookingsPort } from '@/guest/services/ports';
import type { ReactNode } from 'react';

const emptyPage: BookingsPage = {
  items: [],
  pageInfo: { page: 1, pageSize: 10, total: 0, hasNext: false },
};

const auth: AuthPort = {
  getUser: () => Promise.resolve(null),
  requireUser: () => Promise.reject(new Error('not used')),
};

const bookings: BookingsPort = { list: () => Promise.resolve(emptyPage) };

function renderGuestBookings(staleTime?: number) {
  const queryClient = createAppQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <GuestServicesProvider services={{ auth, bookings }}>{children}</GuestServicesProvider>
    </QueryClientProvider>
  );
  const filters = {};
  const options = staleTime === undefined ? {} : { staleTime };
  const view = renderHook(() => useGuestBookings(filters, options), { wrapper });
  return { queryClient, view };
}

function bookingsQueryStaleTime(queryClient: ReturnType<typeof createAppQueryClient>): unknown {
  const query = queryClient.getQueryCache().find({ queryKey: ['bookings', 'list'], exact: false });
  return query?.options.staleTime;
}

describe('useGuestBookings stale time', () => {
  it('uses the client ["bookings"] default when no staleTime option is passed', async () => {
    const { queryClient, view } = renderGuestBookings();
    await waitFor(() => expect(view.result.current.isSuccess).toBe(true));

    expect(bookingsQueryStaleTime(queryClient)).toBe(45_000);
  });

  it('lets an explicit staleTime option win over the client default', async () => {
    const { queryClient, view } = renderGuestBookings(5_000);
    await waitFor(() => expect(view.result.current.isSuccess).toBe(true));

    expect(bookingsQueryStaleTime(queryClient)).toBe(5_000);
  });
});
