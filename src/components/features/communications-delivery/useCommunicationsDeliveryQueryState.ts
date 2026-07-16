'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

import type { OpsEmailDeliveryRange } from '@/types/emailDelivery';

function parseRange(raw: string | null): OpsEmailDeliveryRange {
  return raw === '24h' || raw === '30d' ? raw : '7d';
}

export function useCommunicationsDeliveryQueryState(initialRestaurantId?: string | null) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const restaurantId = useMemo(() => {
    const value = searchParams?.get('restaurantId')?.trim() ?? '';
    return value || initialRestaurantId || null;
  }, [initialRestaurantId, searchParams]);

  const range = useMemo(() => parseRange(searchParams?.get('range') ?? null), [searchParams]);

  const updateQuery = useCallback(
    (next: { restaurantId?: string | null; range?: OpsEmailDeliveryRange }) => {
      const current = new URLSearchParams(searchParams?.toString() ?? '');
      const nextRestaurantId =
        next.restaurantId === undefined ? restaurantId : next.restaurantId ?? null;
      const nextRange = next.range ?? range;

      if (nextRestaurantId) current.set('restaurantId', nextRestaurantId);
      else current.delete('restaurantId');

      if (nextRange === '7d') current.delete('range');
      else current.set('range', nextRange);

      const query = current.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, range, restaurantId, router, searchParams],
  );

  return {
    restaurantId,
    range,
    setRestaurantId: (nextRestaurantId: string | null) =>
      updateQuery({ restaurantId: nextRestaurantId }),
    setRange: (nextRange: OpsEmailDeliveryRange) => updateQuery({ range: nextRange }),
  };
}
