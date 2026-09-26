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
const GUEST_SCHEDULE_QUERY_PREFIX = queryKeys.reservations.schedulePrefix();

/**
 * Which booking-type writes to run. The Availability page creates and updates types before its
 * restaurant save command and deletes them after it (see `planAvailabilitySave`).
 */
export type AvailabilityOccasionSavePhase = 'upserts' | 'deletes' | 'all';

function selectPhase(
  plan: AvailabilityOccasionSavePlan,
  phase: AvailabilityOccasionSavePhase,
): AvailabilityOccasionSavePlan {
  if (phase === 'upserts') return { ...plan, deleteKeys: [] };
  if (phase === 'deletes')
    return { createInputs: [], updateInputs: [], deleteKeys: plan.deleteKeys };
  return plan;
}

/**
 * Writes booking-type changes one at a time. Occasions are a global catalog, editable by
 * Nabatable platform admins only, so their list key carries no restaurant id.
 */
export function useSaveAvailabilityOccasions() {
  const queryClient = useQueryClient();
  const occasionService = useOccasionService();

  return useCallback(
    async ({
      draftOccasions,
      originalOccasions,
      phase = 'all',
    }: {
      readonly draftOccasions: ReadonlyArray<OpsOccasion>;
      readonly originalOccasions: ReadonlyArray<OpsOccasion>;
      readonly phase?: AvailabilityOccasionSavePhase;
    }): Promise<AvailabilityOccasionSavePlan> => {
      const basePlan = selectPhase(
        buildAvailabilityOccasionSavePlan({ draftOccasions, originalOccasions }),
        phase,
      );
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
