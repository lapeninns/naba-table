import type {
  DualSyncOperationFailure,
  DualSyncPlanWarning,
  DualSyncPublishDecision,
  DualSyncPublishPlan,
} from './types';
import type { DualSyncGoogleWriteGroup, DualSyncRiskLevel } from '../registry/types';
import type { DualSyncGoogleUpdateMask, DualSyncSectionKey } from '../types';

export interface GroupAccumulator {
  groupId: string;
  direction: 'import_from_google' | 'export_to_google';
  sectionKey: DualSyncSectionKey;
  writeGroup: DualSyncGoogleWriteGroup | `core.${DualSyncSectionKey}`;
  fields: DualSyncPublishDecision[];
  riskLevel: DualSyncRiskLevel;
  requiresPreflight: boolean;
  requiresManualConfirmation: boolean;
  destructiveWritePossible: boolean;
  googleUpdateMasks: DualSyncGoogleUpdateMask[];
}

export type ExecutablePublishDecision = DualSyncPublishDecision & {
  readonly action: 'import_from_google' | 'export_to_google';
};

export function isExecutablePublishDecision(
  decision: DualSyncPublishDecision,
): decision is ExecutablePublishDecision {
  return decision.action === 'import_from_google' || decision.action === 'export_to_google';
}

export function plannerFailure(
  message: string,
  code: DualSyncOperationFailure['code'] = 'UNSUPPORTED_FIELD',
): DualSyncOperationFailure {
  return { code, message, retryable: false };
}

function rankRisk(risk: DualSyncRiskLevel): number {
  switch (risk) {
    case 'critical':
      return 4;
    case 'high':
      return 3;
    case 'medium':
      return 2;
    case 'low':
      return 1;
    default:
      return 0;
  }
}

export function maxRisk(a: DualSyncRiskLevel, b: DualSyncRiskLevel): DualSyncRiskLevel {
  return rankRisk(b) > rankRisk(a) ? b : a;
}

export function uniqueGoogleUpdateMasks(
  masks: ReadonlyArray<DualSyncGoogleUpdateMask | undefined>,
) {
  return [...new Set(masks.filter((mask): mask is DualSyncGoogleUpdateMask => Boolean(mask)))];
}

export function getPublishGroupKey(input: {
  readonly direction: 'import_from_google' | 'export_to_google';
  readonly sectionKey: DualSyncSectionKey;
  readonly writeGroup: string;
}) {
  return `${input.direction}:${input.sectionKey}:${input.writeGroup}`;
}

export interface UpsertPlannerGroupInput {
  readonly groups: Map<string, GroupAccumulator>;
  readonly decision: ExecutablePublishDecision;
  readonly writeGroup: DualSyncGoogleWriteGroup | `core.${DualSyncSectionKey}`;
  readonly riskLevel: DualSyncRiskLevel;
  readonly requiresPreflight: boolean;
  readonly requiresManualConfirmation: boolean;
  readonly destructiveWritePossible: boolean;
  readonly googleUpdateMasks: ReadonlyArray<DualSyncGoogleUpdateMask>;
}

export function upsertPlannerGroup({
  groups,
  decision,
  writeGroup,
  riskLevel,
  requiresPreflight,
  requiresManualConfirmation,
  destructiveWritePossible,
  googleUpdateMasks,
}: UpsertPlannerGroupInput): void {
  const key = getPublishGroupKey({
    direction: decision.action,
    sectionKey: decision.sectionKey,
    writeGroup,
  });
  const existing = groups.get(key);
  if (existing) {
    existing.fields.push(decision);
    existing.riskLevel = maxRisk(existing.riskLevel, riskLevel);
    existing.requiresPreflight = existing.requiresPreflight || requiresPreflight;
    existing.requiresManualConfirmation =
      existing.requiresManualConfirmation || requiresManualConfirmation;
    existing.destructiveWritePossible =
      existing.destructiveWritePossible || destructiveWritePossible;
    existing.googleUpdateMasks = uniqueGoogleUpdateMasks([
      ...existing.googleUpdateMasks,
      ...googleUpdateMasks,
    ]);
    return;
  }

  groups.set(key, {
    groupId: key,
    direction: decision.action,
    sectionKey: decision.sectionKey,
    writeGroup,
    fields: [decision],
    riskLevel,
    requiresPreflight,
    requiresManualConfirmation,
    destructiveWritePossible,
    googleUpdateMasks: [...googleUpdateMasks],
  });
}

export function buildPlannerWarnings(
  planGroups: ReadonlyArray<GroupAccumulator>,
): DualSyncPublishPlan['warnings'] {
  return planGroups.flatMap((group) => {
    const groupWarnings: DualSyncPlanWarning[] = [];
    if (group.requiresPreflight) {
      groupWarnings.push({
        code: 'PREFLIGHT_REQUIRED',
        groupId: group.groupId,
        message: `${group.sectionKey} requires preflight before publish.`,
      });
    }
    if (group.requiresManualConfirmation) {
      groupWarnings.push({
        code: 'HIGH_RISK',
        groupId: group.groupId,
        message: `${group.sectionKey} includes high-risk fields that require manual confirmation.`,
      });
    }
    if (group.destructiveWritePossible) {
      groupWarnings.push({
        code: 'DESTRUCTIVE_WRITE',
        groupId: group.groupId,
        message: `${group.sectionKey} may replace or clear existing values.`,
      });
    }
    return groupWarnings;
  });
}
