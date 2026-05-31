/**
 * Section-level publish planner.
 *
 * The UI still submits field-level decisions, but this planner converts
 * those decisions into Google/Core-safe execution groups before publish.
 * It is read-only: it reads fresh snapshots, validates pinned hashes and
 * policy, then returns the section/write-group plan the operator should
 * review.
 */

import { getDualSyncDecisionDisabledReason } from '../flag';
import { hashCanonicalJson } from '../hashing';
import { findFieldConfig, resolveFieldCapability } from '../registry';
import { valueForField } from './orchestrator-domain';
import { validatePublishDecisionPins } from './pinning';
import {
  buildPlannerWarnings,
  isExecutablePublishDecision,
  plannerFailure,
  uniqueGoogleUpdateMasks,
  upsertPlannerGroup,
  type GroupAccumulator,
} from './planner-domain';
import { readPublishPlannerRuntime } from './planner-runtime';

import type { BuildPublishPlanOptions } from './planner-runtime';
import type {
  DualSyncOperationFailure,
  DualSyncPublishPlan,
  DualSyncRunPublishInput,
  DualSyncRejectedDecision,
} from './types';
import type { DualSyncSectionKey } from '../types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

export type { BuildPublishPlanOptions };

export async function buildPublishPlan(
  client: DbClient,
  input: DualSyncRunPublishInput,
  options: BuildPublishPlanOptions = {},
): Promise<DualSyncPublishPlan> {
  const {
    coreSnapshot,
    gbpSnapshot,
    coreSnapshotHash,
    gbpSnapshotHash,
    registry,
    runtimeFlags,
    control,
  } = await readPublishPlannerRuntime({
    client,
    restaurantId: input.restaurantId,
    options,
  });
  const rejected: DualSyncRejectedDecision[] = [];
  const groups = new Map<string, GroupAccumulator>();
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
      failure: plannerFailure(message, code),
    })),
    warnings: [],
    acceptedCount: 0,
    rejectedCount: input.decisions.length,
    ignoredCount: 0,
  });

  if (!input.pinnedCoreSnapshotHash) {
    return rejectAllForSnapshotDrift(
      'INVALID_DECISION',
      'Publish planning requires a pinned Core snapshot hash.',
    );
  }
  if (!input.pinnedGbpSnapshotHash) {
    return rejectAllForSnapshotDrift(
      'INVALID_DECISION',
      'Publish planning requires a pinned Google snapshot hash.',
    );
  }
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
        failure: plannerFailure(`Unknown field key ${decision.fieldKey}.`, 'INVALID_DECISION'),
      });
      continue;
    }
    if (decision.sectionKey !== config.sectionKey) {
      rejected.push({
        fieldKey: decision.fieldKey,
        sectionKey: decision.sectionKey,
        action: decision.action,
        failure: plannerFailure(
          `Field ${decision.fieldKey} belongs to ${config.sectionKey}, not ${decision.sectionKey}.`,
          'INVALID_DECISION',
        ),
      });
      continue;
    }

    const pinValidationFailure = validatePublishDecisionPins(decision);
    if (pinValidationFailure) {
      rejected.push({
        fieldKey: decision.fieldKey,
        sectionKey: decision.sectionKey,
        action: decision.action,
        failure: pinValidationFailure,
      });
      continue;
    }

    const coreValue = valueForField(coreSnapshot, config, 'core');
    const gbpValue = valueForField(gbpSnapshot, config, 'gbp');
    const beforeCoreHash = hashCanonicalJson(config.canonicalizeCoreValue(coreValue));
    const beforeGbpHash = hashCanonicalJson(config.canonicalizeGbpValue(gbpValue));
    if (beforeCoreHash !== decision.pinnedCoreHash) {
      rejected.push({
        fieldKey: decision.fieldKey,
        sectionKey: decision.sectionKey,
        action: decision.action,
        failure: plannerFailure(
          'Core value moved since the operator viewed the diff.',
          'CORE_DRIFT',
        ),
      });
      continue;
    }
    if (beforeGbpHash !== decision.pinnedGbpHash) {
      rejected.push({
        fieldKey: decision.fieldKey,
        sectionKey: decision.sectionKey,
        action: decision.action,
        failure: plannerFailure(
          'Google value moved since the operator viewed the diff.',
          'GBP_DRIFT',
        ),
      });
      continue;
    }
    if (decision.action === 'ignore') {
      ignoredCount += 1;
      continue;
    }
    if (!isExecutablePublishDecision(decision)) {
      rejected.push({
        fieldKey: decision.fieldKey,
        sectionKey: decision.sectionKey,
        action: decision.action,
        failure: plannerFailure(
          `Unsupported decision action ${decision.action}.`,
          'INVALID_DECISION',
        ),
      });
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
        failure: plannerFailure(flagDisabledReason, 'UNSUPPORTED_FIELD'),
      });
      continue;
    }

    const capability = resolveFieldCapability({ config, coreValue, gbpValue });
    if (decision.action === 'import_from_google' && !capability.canImport) {
      rejected.push({
        fieldKey: decision.fieldKey,
        sectionKey: decision.sectionKey,
        action: decision.action,
        failure: plannerFailure(
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
        failure: plannerFailure(
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
        failure: plannerFailure('Field requires manual review before it can be exported.'),
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
        failure: plannerFailure(config.policy.noWriteReason ?? 'Field policy has no write group.'),
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
      decision.action === 'export_to_google'
        ? uniqueGoogleUpdateMasks([config.googleUpdateMask])
        : [];
    upsertPlannerGroup({
      groups,
      decision,
      writeGroup,
      riskLevel: config.policy.riskLevel,
      requiresPreflight,
      requiresManualConfirmation,
      destructiveWritePossible,
      googleUpdateMasks,
    });
  }

  const planGroups = [...groups.values()];
  const warnings = buildPlannerWarnings(planGroups);

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
