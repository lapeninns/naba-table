/**
 * Section-level publish planner.
 *
 * The UI still submits field-level decisions, but this planner converts
 * those decisions into Google/Core-safe execution groups before publish.
 * It is read-only: it reads fresh snapshots, validates pinned hashes and
 * policy, then returns the section/write-group plan the operator should
 * review.
 */

import { getDualSyncRestaurantControl } from '../controls';
import { getDualSyncDecisionDisabledReason, getDualSyncRuntimeFlags } from '../flag';
import { hashCanonicalJson } from '../hashing';
import { buildRegistry, findFieldConfig, resolveFieldCapability } from '../registry';
import { readGoogleSnapshot } from '../snapshots/google';
import { readNabatableSnapshot } from '../snapshots/nabatable';

import type {
  DualSyncOperationFailure,
  DualSyncPublishDecision,
  DualSyncPlanWarning,
  DualSyncPublishPlan,
  DualSyncRunPublishInput,
  DualSyncRejectedDecision,
} from './types';
import type { DualSyncGoogleWriteGroup, DualSyncRiskLevel } from '../registry/types';
import type { DualSyncCanonicalSnapshot } from '../snapshots/types';
import type { DualSyncGoogleUpdateMask, DualSyncSectionKey } from '../types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

export interface BuildPublishPlanOptions {
  readonly readCoreSnapshot?: (input: {
    readonly client: DbClient;
    readonly restaurantId: string;
  }) => Promise<DualSyncCanonicalSnapshot>;
  readonly readGbpSnapshot?: (input: {
    readonly client: DbClient;
    readonly restaurantId: string;
  }) => Promise<DualSyncCanonicalSnapshot>;
}

interface GroupAccumulator {
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

function failure(
  message: string,
  code: DualSyncOperationFailure['code'] = 'UNSUPPORTED_FIELD',
): DualSyncOperationFailure {
  return { code, message, retryable: false };
}

function readSectionValue(
  snapshot: DualSyncCanonicalSnapshot,
  sectionKey: DualSyncSectionKey | 'core_only',
): unknown {
  switch (sectionKey) {
    case 'profile':
      return snapshot.profile;
    case 'operatingHours':
      return snapshot.operatingHours;
    case 'servicePeriods':
      return snapshot.servicePeriods;
    case 'businessContext.categories':
      return snapshot.businessContext.categories;
    case 'businessContext.serviceAreas':
      return snapshot.businessContext.serviceAreas;
    case 'businessContext.attributes':
      return snapshot.businessContext.attributes;
    case 'businessContext.serviceItems':
      return snapshot.businessContext.serviceItems;
    case 'foodMenus':
      return snapshot.foodMenus ?? { items: [] };
    case 'core_only':
      return null;
    default:
      return null;
  }
}

function valueForField(
  snapshot: DualSyncCanonicalSnapshot,
  config: NonNullable<ReturnType<typeof findFieldConfig>>,
  side: 'core' | 'gbp',
): unknown {
  const sectionValue = readSectionValue(snapshot, config.sectionKey);
  if (sectionValue === null || sectionValue === undefined) return null;
  if (config.kind === 'profile') {
    const profileKey = config.fieldKey.split('.')[1];
    if (!profileKey) return null;
    return (sectionValue as Record<string, unknown>)[profileKey] ?? null;
  }
  if (config.kind === 'core_only') {
    return side === 'core' ? sectionValue : null;
  }
  return sectionValue;
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

function maxRisk(a: DualSyncRiskLevel, b: DualSyncRiskLevel): DualSyncRiskLevel {
  return rankRisk(b) > rankRisk(a) ? b : a;
}

function uniqueMasks(masks: ReadonlyArray<DualSyncGoogleUpdateMask | undefined>) {
  return [...new Set(masks.filter((mask): mask is DualSyncGoogleUpdateMask => Boolean(mask)))];
}

function groupKey(input: {
  readonly direction: 'import_from_google' | 'export_to_google';
  readonly sectionKey: DualSyncSectionKey;
  readonly writeGroup: string;
}) {
  return `${input.direction}:${input.sectionKey}:${input.writeGroup}`;
}

export async function buildPublishPlan(
  client: DbClient,
  input: DualSyncRunPublishInput,
  options: BuildPublishPlanOptions = {},
): Promise<DualSyncPublishPlan> {
  const readCore = options.readCoreSnapshot ?? readNabatableSnapshot;
  const readGbp = options.readGbpSnapshot ?? readGoogleSnapshot;
  const [coreSnapshot, gbpSnapshot] = await Promise.all([
    readCore({ client, restaurantId: input.restaurantId }),
    readGbp({ client, restaurantId: input.restaurantId }),
  ]);
  const coreSnapshotHash = hashCanonicalJson(coreSnapshot) ?? '';
  const gbpSnapshotHash = hashCanonicalJson(gbpSnapshot) ?? '';
  const rejected: DualSyncRejectedDecision[] = [];
  const groups = new Map<string, GroupAccumulator>();
  const registry = buildRegistry({ coreSnapshot, gbpSnapshot, includeCoreOnly: false });
  const runtimeFlags = getDualSyncRuntimeFlags({ restaurantId: input.restaurantId });
  const control = await getDualSyncRestaurantControl({
    client,
    restaurantId: input.restaurantId,
  });
  let ignoredCount = 0;

  const rejectAllForSnapshotDrift = (
    code: DualSyncOperationFailure['code'],
    message: string,
  ): DualSyncPublishPlan => ({
    restaurantId: input.restaurantId,
    coreSnapshotHash,
    gbpSnapshotHash,
    groups: [],
    rejected: input.decisions.map((decision) => ({
      fieldKey: decision.fieldKey,
      sectionKey: decision.sectionKey,
      action: decision.action,
      failure: failure(message, code),
    })),
    warnings: [],
    acceptedCount: 0,
    rejectedCount: input.decisions.length,
    ignoredCount: 0,
  });

  if (input.pinnedCoreSnapshotHash && input.pinnedCoreSnapshotHash !== coreSnapshotHash) {
    return rejectAllForSnapshotDrift(
      'CORE_DRIFT',
      'Core snapshot moved since the operator viewed the diff.',
    );
  }
  if (input.pinnedGbpSnapshotHash && input.pinnedGbpSnapshotHash !== gbpSnapshotHash) {
    return rejectAllForSnapshotDrift(
      'GBP_DRIFT',
      'Google snapshot moved since the operator viewed the diff.',
    );
  }
  if (control.syncPaused) {
    return rejectAllForSnapshotDrift(
      'SYNC_PAUSED',
      control.pauseReason ?? 'Dual-sync is paused for this restaurant.',
    );
  }

  for (const decision of input.decisions) {
    const config = findFieldConfig(registry, decision.fieldKey);
    if (!config) {
      rejected.push({
        fieldKey: decision.fieldKey,
        sectionKey: decision.sectionKey,
        action: decision.action,
        failure: failure(`Unknown field key ${decision.fieldKey}.`, 'INVALID_DECISION'),
      });
      continue;
    }
    if (decision.sectionKey !== config.sectionKey) {
      rejected.push({
        fieldKey: decision.fieldKey,
        sectionKey: decision.sectionKey,
        action: decision.action,
        failure: failure(
          `Field ${decision.fieldKey} belongs to ${config.sectionKey}, not ${decision.sectionKey}.`,
          'INVALID_DECISION',
        ),
      });
      continue;
    }

    const coreValue = valueForField(coreSnapshot, config, 'core');
    const gbpValue = valueForField(gbpSnapshot, config, 'gbp');
    const beforeCoreHash = hashCanonicalJson(config.canonicalizeCoreValue(coreValue));
    const beforeGbpHash = hashCanonicalJson(config.canonicalizeGbpValue(gbpValue));
    if (decision.pinnedCoreHash && beforeCoreHash !== decision.pinnedCoreHash) {
      rejected.push({
        fieldKey: decision.fieldKey,
        sectionKey: decision.sectionKey,
        action: decision.action,
        failure: failure('Core value moved since the operator viewed the diff.', 'CORE_DRIFT'),
      });
      continue;
    }
    if (decision.pinnedGbpHash && beforeGbpHash !== decision.pinnedGbpHash) {
      rejected.push({
        fieldKey: decision.fieldKey,
        sectionKey: decision.sectionKey,
        action: decision.action,
        failure: failure('Google value moved since the operator viewed the diff.', 'GBP_DRIFT'),
      });
      continue;
    }
    if (decision.action === 'ignore') {
      ignoredCount += 1;
      continue;
    }

    const flagDisabledReason = getDualSyncDecisionDisabledReason(
      {
        action: decision.action,
        sectionKey: config.sectionKey,
        riskLevel: config.policy.riskLevel,
        requiresManualReview: config.policy.requiresManualReview,
      },
      runtimeFlags,
    );
    if (flagDisabledReason) {
      rejected.push({
        fieldKey: decision.fieldKey,
        sectionKey: decision.sectionKey,
        action: decision.action,
        failure: failure(flagDisabledReason, 'UNSUPPORTED_FIELD'),
      });
      continue;
    }

    const capability = resolveFieldCapability({ config, coreValue, gbpValue });
    if (decision.action === 'import_from_google' && !capability.canImport) {
      rejected.push({
        fieldKey: decision.fieldKey,
        sectionKey: decision.sectionKey,
        action: decision.action,
        failure: failure(
          capability.blockedReasons[0] ?? 'Field policy does not allow importing this field.',
        ),
      });
      continue;
    }
    if (decision.action === 'export_to_google' && !capability.canExport) {
      rejected.push({
        fieldKey: decision.fieldKey,
        sectionKey: decision.sectionKey,
        action: decision.action,
        failure: failure(
          config.policy.noWriteReason ??
            config.exportBlockedReason ??
            capability.blockedReasons[0] ??
            'Field policy does not allow exporting this field.',
        ),
      });
      continue;
    }
    if (
      decision.action === 'export_to_google' &&
      config.policy.requiresManualReview &&
      input.actorUserId === null
    ) {
      rejected.push({
        fieldKey: decision.fieldKey,
        sectionKey: decision.sectionKey,
        action: decision.action,
        failure: failure('Field requires manual review before it can be exported.'),
      });
      continue;
    }

    const writeGroup =
      decision.action === 'export_to_google'
        ? config.policy.googleWriteGroup
        : (`core.${config.sectionKey}` as `core.${DualSyncSectionKey}`);
    if (!writeGroup) {
      rejected.push({
        fieldKey: decision.fieldKey,
        sectionKey: decision.sectionKey,
        action: decision.action,
        failure: failure(config.policy.noWriteReason ?? 'Field policy has no write group.'),
      });
      continue;
    }

    const requiresPreflight =
      decision.action === 'export_to_google' &&
      (config.policy.destructiveWritePossible ||
        config.policy.riskLevel === 'high' ||
        config.policy.riskLevel === 'critical');
    const requiresManualConfirmation =
      decision.action === 'export_to_google' && config.policy.requiresManualReview;
    const destructiveWritePossible =
      decision.action === 'export_to_google' && config.policy.destructiveWritePossible;
    const googleUpdateMasks =
      decision.action === 'export_to_google' ? uniqueMasks([config.googleUpdateMask]) : [];
    const key = groupKey({
      direction: decision.action,
      sectionKey: decision.sectionKey,
      writeGroup,
    });
    const existing = groups.get(key);
    if (existing) {
      existing.fields.push(decision);
      existing.riskLevel = maxRisk(existing.riskLevel, config.policy.riskLevel);
      existing.requiresPreflight = existing.requiresPreflight || requiresPreflight;
      existing.requiresManualConfirmation =
        existing.requiresManualConfirmation || requiresManualConfirmation;
      existing.destructiveWritePossible =
        existing.destructiveWritePossible || destructiveWritePossible;
      existing.googleUpdateMasks = uniqueMasks([
        ...existing.googleUpdateMasks,
        ...googleUpdateMasks,
      ]);
      continue;
    }

    const group: GroupAccumulator = {
      groupId: key,
      direction: decision.action,
      sectionKey: decision.sectionKey,
      writeGroup,
      fields: [decision],
      riskLevel: config.policy.riskLevel,
      requiresPreflight,
      requiresManualConfirmation,
      destructiveWritePossible,
      googleUpdateMasks,
    };
    groups.set(key, group);
  }

  const planGroups = [...groups.values()];
  const warnings: DualSyncPublishPlan['warnings'] = planGroups.flatMap((group) => {
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

  return {
    restaurantId: input.restaurantId,
    coreSnapshotHash,
    gbpSnapshotHash,
    groups: planGroups,
    rejected,
    warnings,
    acceptedCount: planGroups.reduce((sum, group) => sum + group.fields.length, 0),
    rejectedCount: rejected.length,
    ignoredCount,
  };
}
