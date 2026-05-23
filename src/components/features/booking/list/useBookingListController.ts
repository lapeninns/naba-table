'use client';

import { useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useGuestBookings } from '@/guest/hooks';
import { normalizeBookingsTab, type BookingsTab } from '@/guest/lib/validation';
import { queryKeys } from '@/lib/query/keys';

import { groupBookingsByTimeline } from './bookingListDomain';

export type UseBookingListControllerProps = {
  initialTab?: BookingsTab;
};

export function useBookingListController({
  initialTab = 'upcoming',
}: UseBookingListControllerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const {
    data: bookings,
    isLoading,
    isError,
  } = useGuestBookings(
    { pageSize: 50 },
    {
      staleTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      refetchInterval: false,
    },
  );
  const [activeTab, setActiveTab] = useState<BookingsTab>(normalizeBookingsTab(initialTab));

  useEffect(() => {
    const normalized = normalizeBookingsTab(searchParams.get('tab'));
    setActiveTab((prev) => (prev === normalized ? prev : normalized));
  }, [searchParams]);

  const { upcoming, past } = useMemo(
    () => groupBookingsByTimeline(bookings?.items ?? []),
    [bookings?.items],
  );

  const handleRetry = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all });
  }, [queryClient]);

  const handleTabChange = useCallback(
    (value: string) => {
      const next = normalizeBookingsTab(value);
      setActiveTab(next);
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', next === 'past' ? 'history' : 'upcoming');
      const search = params.toString();
      router.replace(`${pathname}?${search}`);
    },
    [pathname, router, searchParams],
  );

  return {
    activeTab,
    bookings,
    handleRetry,
    handleTabChange,
    hasAnyBookings: (bookings?.items?.length ?? 0) > 0,
    isError,
    isLoading,
    past,
    upcoming,
  };
}
