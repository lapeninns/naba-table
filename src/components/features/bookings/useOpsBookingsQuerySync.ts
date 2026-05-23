'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useTransition } from 'react';

import {
  buildOpsBookingsUpdatedSearchParams,
  getOpsBookingsBasePath,
} from '@/components/features/bookings/opsBookingsQueryDomain';

export type UpdateOpsBookingsSearchParams = (updates: Record<string, string | null>) => void;

export type UseOpsBookingsQuerySyncParams = {
  activeRestaurantId: string | null;
  isOnline: boolean;
};

export function useOpsBookingsQuerySync({
  activeRestaurantId,
  isOnline,
}: UseOpsBookingsQuerySyncParams) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const searchParamsKey = searchParams?.toString() ?? '';
  const urlParams = useMemo(() => new URLSearchParams(searchParamsKey), [searchParamsKey]);
  const opsBasePath = useMemo(() => getOpsBookingsBasePath(pathname), [pathname]);

  const updateSearchParams = useCallback<UpdateOpsBookingsSearchParams>(
    (updates) => {
      if (!isOnline) {
        return;
      }

      const nextQuery = buildOpsBookingsUpdatedSearchParams({
        currentSearch: searchParamsKey,
        updates,
      });
      if (nextQuery === searchParamsKey) {
        return;
      }

      startTransition(() => {
        router.replace(`${pathname}${nextQuery ? `?${nextQuery}` : ''}`, { scroll: false });
      });
    },
    [isOnline, pathname, router, searchParamsKey, startTransition],
  );

  useEffect(() => {
    if (!activeRestaurantId || !isOnline) {
      return;
    }

    const currentParam = urlParams.get('restaurantId');
    if (currentParam === activeRestaurantId) {
      return;
    }

    updateSearchParams({ restaurantId: activeRestaurantId });
  }, [activeRestaurantId, isOnline, updateSearchParams, urlParams]);

  useEffect(() => {
    if (!isOnline) return;
    if (urlParams.get('page') || urlParams.get('pageSize') || urlParams.get('status')) {
      updateSearchParams({});
    }
  }, [isOnline, updateSearchParams, urlParams]);

  return {
    opsBasePath,
    updateSearchParams,
    urlParams,
  } as const;
}
