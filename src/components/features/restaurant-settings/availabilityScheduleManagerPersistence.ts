import { buildAvailabilityOccasionSavePlan } from './availabilitySchedulePayloadDomain';

import type { AvailabilityOccasionSavePlan } from './availabilitySchedulePayloadDomain';
import type { OccasionService, OpsOccasion } from '@/services/ops/occasions';

export async function persistAvailabilityOccasionDrafts({
  draftOccasions,
  occasionService,
  originalOccasions,
}: {
  readonly draftOccasions: ReadonlyArray<OpsOccasion>;
  readonly occasionService: OccasionService;
  readonly originalOccasions: ReadonlyArray<OpsOccasion>;
}): Promise<AvailabilityOccasionSavePlan> {
  const plan = buildAvailabilityOccasionSavePlan({
    draftOccasions,
    originalOccasions,
  });

  for (const input of plan.createInputs) {
    await occasionService.createOccasion(input);
  }

  for (const update of plan.updateInputs) {
    await occasionService.updateOccasion(update.key, update.input);
  }

  for (const key of plan.deleteKeys) {
    await occasionService.deleteOccasion(key);
  }

  return plan;
}
