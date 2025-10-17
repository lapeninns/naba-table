'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useBookingService } from '@/contexts/ops-services';
import type { OpsBookingStatus } from '@/types/ops';

type UseOpsBookingStatusSummaryOptions = {
  restaurantId: string | null;
  from?: Date | string | null;
  to?: Date | string | null;
  statuses?: OpsBookingStatus[];
  enabled?: boolean;
};

function toIso(input?: Date | string | null): string | null {
  if (!input) return null;
  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : input.toISOString();
  }
  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function useOpsBookingStatusSummary({
  restaurantId,
  from,
  to,
  statuses,
  enabled = true,
}: UseOpsBookingStatusSummaryOptions) {
  const bookingService = useBookingService();

  const queryKey = useMemo(() => {
    const fromIso = toIso(from);
    const toIsoValue = toIso(to);
    const normalizedStatuses = statuses && statuses.length > 0 ? [...new Set(statuses)].sort() : [];

    return [
      'ops',
      'bookings',
      'status-summary',
      restaurantId ?? 'none',
      fromIso,
      toIsoValue,
      normalizedStatuses.join(','),
    ] as const;
  }, [restaurantId, from, to, statuses]);

  return useQuery({
    queryKey,
    enabled: enabled && Boolean(restaurantId),
    queryFn: async () => {
      if (!restaurantId) {
        throw new Error('Restaurant is required');
      }

      const response = await bookingService.getStatusSummary({
        restaurantId,
        from: toIso(from) ?? undefined,
        to: toIso(to) ?? undefined,
        statuses: statuses && statuses.length > 0 ? statuses : undefined,
      });

      return response;
    },
    staleTime: 30_000,
  });
}

