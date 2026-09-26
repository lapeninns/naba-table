'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { useOccasionService } from '@/contexts/ops-services';
import { queryKeys } from '@/lib/query/keys';
import { OPS_SETTINGS_STALE_TIME } from '@/lib/query/staleTimes';

import {
  executeAvailabilityOccasionSavePlan,
  isAvailabilityOccasionSavePlanEmpty,
  reconcileAvailabilityOccasionSavePlan,
} from '../availabilityScheduleManagerPersistence';
import { buildAvailabilityOccasionSavePlan } from '../availabilitySchedulePayloadDomain';

import type { AvailabilityOccasionSavePlan } from '../availabilitySchedulePayloadDomain';
import type { OpsOccasion } from '@/services/ops/occasions';

/** Prefix of the guest booking schedule (`scheduleQueryKey`), which embeds the occasion catalog. */
const GUEST_SCHEDULE_QUERY_PREFIX = ['reservations', 'schedule'] as const;

/**
 * Writes booking-type changes one at a time. Occasions are a global catalog, so their list key
 * carries no restaurant id.
 */
export function useSaveAvailabilityOccasions() {
  const queryClient = useQueryClient();
  const occasionService = useOccasionService();

  return useCallback(
    async ({
      draftOccasions,
      originalOccasions,
    }: {
      readonly draftOccasions: ReadonlyArray<OpsOccasion>;
      readonly originalOccasions: ReadonlyArray<OpsOccasion>;
    }): Promise<AvailabilityOccasionSavePlan> => {
      const basePlan = buildAvailabilityOccasionSavePlan({ draftOccasions, originalOccasions });
      if (isAvailabilityOccasionSavePlanEmpty(basePlan)) {
        return basePlan;
      }

      // A failed attempt invalidates the list below, so a retry reads what the server now holds
      // rather than the baseline the page never committed.
      const serverOccasions = await queryClient.fetchQuery({
        queryKey: queryKeys.opsOccasions.list(),
        queryFn: () => occasionService.listOccasions(),
        staleTime: OPS_SETTINGS_STALE_TIME.occasions,
      });
      const plan = reconcileAvailabilityOccasionSavePlan({
        draftOccasions,
        plan: basePlan,
        serverOccasions,
      });

      try {
        await executeAvailabilityOccasionSavePlan(plan, occasionService);
      } finally {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.opsOccasions.list() }),
          queryClient.invalidateQueries({ queryKey: GUEST_SCHEDULE_QUERY_PREFIX }),
        ]);
      }
      return plan;
    },
    [occasionService, queryClient],
  );
}
