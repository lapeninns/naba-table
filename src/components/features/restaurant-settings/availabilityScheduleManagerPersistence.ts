import {
  buildAvailabilityOccasionSavePlan,
  hasOccasionDraftChanged,
} from './availabilitySchedulePayloadDomain';

import type { AvailabilityOccasionSavePlan } from './availabilitySchedulePayloadDomain';
import type { OccasionService, OpsOccasion } from '@/services/ops/occasions';

export function isAvailabilityOccasionSavePlanEmpty(plan: AvailabilityOccasionSavePlan): boolean {
  return (
    plan.createInputs.length === 0 && plan.updateInputs.length === 0 && plan.deleteKeys.length === 0
  );
}

/**
 * Drops writes the server already holds, so a retry after a partial save does not re-create a
 * booking type (the API answers 409) or delete one twice (404). Keys created by the failed attempt
 * become updates, and only when they still differ from the draft.
 */
export function reconcileAvailabilityOccasionSavePlan({
  draftOccasions,
  plan,
  serverOccasions,
}: {
  readonly draftOccasions: ReadonlyArray<OpsOccasion>;
  readonly plan: AvailabilityOccasionSavePlan;
  readonly serverOccasions: ReadonlyArray<OpsOccasion>;
}): AvailabilityOccasionSavePlan {
  const serverByKey = new Map(serverOccasions.map((occasion) => [occasion.key, occasion]));
  const draftByKey = new Map(draftOccasions.map((occasion) => [occasion.key, occasion]));
  const needsWrite = (key: string) => {
    const server = serverByKey.get(key);
    const draft = draftByKey.get(key);
    return !server || !draft || hasOccasionDraftChanged(server, draft);
  };

  const createInputs = plan.createInputs.filter((input) => !serverByKey.has(input.key));
  const createdAlready = plan.createInputs
    .filter((input) => serverByKey.has(input.key) && needsWrite(input.key))
    .map((input) => {
      const { key, ...rest } = input;
      return { key, input: rest };
    });

  return {
    createInputs,
    updateInputs: [
      ...createdAlready,
      ...plan.updateInputs.filter((update) => needsWrite(update.key)),
    ],
    deleteKeys: plan.deleteKeys.filter((key) => serverByKey.has(key)),
  };
}

export async function executeAvailabilityOccasionSavePlan(
  plan: AvailabilityOccasionSavePlan,
  occasionService: OccasionService,
): Promise<void> {
  for (const input of plan.createInputs) {
    await occasionService.createOccasion(input);
  }

  for (const update of plan.updateInputs) {
    await occasionService.updateOccasion(update.key, update.input);
  }

  for (const key of plan.deleteKeys) {
    await occasionService.deleteOccasion(key);
  }
}

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

  await executeAvailabilityOccasionSavePlan(plan, occasionService);

  return plan;
}
