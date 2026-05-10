'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useBookingService } from '@/contexts/ops-services';
import { toIsoDateParam } from '@/hooks/ops/utils/toIsoDateParam';
import { HttpError } from '@/lib/http/errors';

import type { OpsBookingStatus } from '@/types/ops';

type UseOpsBookingStatusSummaryOptions = {
  restaurantId: string | null;
  from?: Date | string | null;
  to?: Date | string | null;
  statuses?: OpsBookingStatus[];
  enabled?: boolean;
};

export function useOpsBookingStatusSummary({
  restaurantId,
  from,
  to,
  statuses,
  enabled = true,
}: UseOpsBookingStatusSummaryOptions) {
  const bookingService = useBookingService();
  const fromIso = toIsoDateParam(from);
  const toIsoValue = toIsoDateParam(to);

  const queryKey = useMemo(() => {
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
  }, [restaurantId, fromIso, toIsoValue, statuses]);

  return useQuery({
    queryKey,
    enabled: enabled && Boolean(restaurantId) && Boolean(fromIso) && Boolean(toIsoValue),
    queryFn: async () => {
      if (!restaurantId || !fromIso || !toIsoValue) {
        throw new Error('Restaurant and date range are required');
      }
      const normalizedStatuses = statuses && statuses.length > 0 ? statuses : undefined;

      try {
        return await bookingService.getStatusSummary({
          restaurantId,
          from: fromIso,
          to: toIsoValue,
          statuses: normalizedStatuses,
        });
      } catch (error) {
        if (error instanceof HttpError && error.status === 404) {
          return {
            restaurantId,
            range: {
              from: fromIso ?? null,
              to: toIsoValue ?? null,
            },
            filter: {
              statuses: normalizedStatuses ?? null,
            },
            totals: {
              pending: 0,
              pending_allocation: 0,
              confirmed: 0,
              checked_in: 0,
              completed: 0,
              cancelled: 0,
              no_show: 0,
              PRIORITY_WAITLIST: 0,
            } as Record<OpsBookingStatus, number>,
            generatedAt: new Date().toISOString(),
          };
        }

        throw error;
      }
    },
    staleTime: 30_000,
  });
}
