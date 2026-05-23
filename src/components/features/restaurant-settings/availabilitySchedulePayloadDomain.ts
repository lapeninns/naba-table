import { canonicalizeRequiredTime } from './availabilityScheduleTime';
import { buildServicePeriodPayload, type DayServiceConfig } from './servicePeriodsMapper';

import type {
  CreateOccasionInput,
  OpsOccasion,
  UpdateOccasionInput,
} from '@/services/ops/occasions';
import type { ServicePeriodRow, TurnBandInput, TurnBandsPayload } from '@/services/ops/restaurants';

export type AvailabilityOccasionUpdatePlan = {
  key: string;
  input: UpdateOccasionInput;
};

export type AvailabilityOccasionSavePlan = {
  createInputs: CreateOccasionInput[];
  deleteKeys: string[];
  updateInputs: AvailabilityOccasionUpdatePlan[];
};

export function buildAvailabilityServicePayload({
  customRows,
  dayConfigs,
  occasionKeys,
}: {
  readonly customRows: ServicePeriodRow[];
  readonly dayConfigs: ReadonlyArray<DayServiceConfig>;
  readonly occasionKeys: {
    readonly lunch: string;
    readonly dinner: string;
  };
}): ServicePeriodRow[] {
  return buildServicePeriodPayload(
    dayConfigs.map((day) =>
      day.isClosed
        ? {
            ...day,
            lunch: { ...day.lunch, enabled: false },
            dinner: { ...day.dinner, enabled: false },
          }
        : day,
    ),
    {
      customRows,
      canonicalizeTime: canonicalizeRequiredTime,
      occasionKeys,
    },
  );
}

export function hasOccasionDraftChanged(original: OpsOccasion, draft: OpsOccasion): boolean {
  return (
    original.label !== draft.label ||
    original.shortLabel !== draft.shortLabel ||
    (original.description ?? null) !== (draft.description ?? null) ||
    JSON.stringify(original.availability ?? []) !== JSON.stringify(draft.availability ?? []) ||
    original.defaultDurationMinutes !== draft.defaultDurationMinutes ||
    original.displayOrder !== draft.displayOrder ||
    original.isActive !== draft.isActive
  );
}

function buildCreateOccasionInput(occasion: OpsOccasion): CreateOccasionInput {
  return {
    key: occasion.key,
    label: occasion.label,
    shortLabel: occasion.shortLabel,
    description: occasion.description ?? null,
    availability: occasion.availability,
    defaultDurationMinutes: occasion.defaultDurationMinutes,
    displayOrder: occasion.displayOrder,
    isActive: occasion.isActive,
  };
}

function buildUpdateOccasionInput(occasion: OpsOccasion): UpdateOccasionInput {
  return {
    label: occasion.label,
    shortLabel: occasion.shortLabel,
    description: occasion.description ?? null,
    availability: occasion.availability,
    defaultDurationMinutes: occasion.defaultDurationMinutes,
    displayOrder: occasion.displayOrder,
    isActive: occasion.isActive,
  };
}

export function buildAvailabilityOccasionSavePlan({
  draftOccasions,
  originalOccasions,
}: {
  readonly draftOccasions: ReadonlyArray<OpsOccasion>;
  readonly originalOccasions: ReadonlyArray<OpsOccasion>;
}): AvailabilityOccasionSavePlan {
  const originalByKey = new Map(originalOccasions.map((occasion) => [occasion.key, occasion]));
  const draftByKey = new Map(draftOccasions.map((occasion) => [occasion.key, occasion]));
  const createInputs: CreateOccasionInput[] = [];
  const updateInputs: AvailabilityOccasionUpdatePlan[] = [];
  const deleteKeys: string[] = [];

  for (const draft of draftOccasions) {
    const original = originalByKey.get(draft.key);
    if (!original) {
      createInputs.push(buildCreateOccasionInput(draft));
      continue;
    }

    if (hasOccasionDraftChanged(original, draft)) {
      updateInputs.push({
        key: draft.key,
        input: buildUpdateOccasionInput(draft),
      });
    }
  }

  for (const original of originalOccasions) {
    if (!draftByKey.has(original.key) && !original.isBuiltin) {
      deleteKeys.push(original.key);
    }
  }

  return {
    createInputs,
    deleteKeys,
    updateInputs,
  };
}

export function buildAvailabilityTurnBandsPayload({
  occasionDrafts,
  servicePeriods,
  turnBandsDraft,
}: {
  readonly occasionDrafts: ReadonlyArray<OpsOccasion>;
  readonly servicePeriods: ReadonlyArray<ServicePeriodRow>;
  readonly turnBandsDraft: TurnBandsPayload;
}): TurnBandsPayload {
  const activeKeys = new Set<string>();
  servicePeriods.forEach((period) => activeKeys.add(period.bookingOption));
  occasionDrafts.forEach((occasion) => activeKeys.add(occasion.key));
  activeKeys.add('lunch');
  activeKeys.add('dinner');

  const bandsPayload: TurnBandsPayload = {};
  Object.entries(turnBandsDraft).forEach(([key, rows]) => {
    if (!rows || rows.length === 0) return;
    if (!activeKeys.has(key)) return;
    bandsPayload[key] = rows
      .map((row: TurnBandInput) => ({
        maxPartySize: Number(row.maxPartySize),
        durationMinutes: Number(row.durationMinutes),
      }))
      .filter((row) => Number.isFinite(row.maxPartySize) && Number.isFinite(row.durationMinutes))
      .sort((a, b) => a.maxPartySize - b.maxPartySize);
  });

  return bandsPayload;
}
