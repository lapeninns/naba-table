'use client';

import { useEffect } from 'react';

import { useOpsSession } from '@/contexts/ops-session';

export function useOpsBookingsRestaurantSync({
  initialRestaurantId,
}: {
  initialRestaurantId?: string | null;
}) {
  const { syncActiveRestaurantIdFromRoute } = useOpsSession();
  const normalizedInitialRestaurantId = initialRestaurantId ?? null;

  useEffect(() => {
    syncActiveRestaurantIdFromRoute(normalizedInitialRestaurantId);
  }, [normalizedInitialRestaurantId, syncActiveRestaurantIdFromRoute]);
}
