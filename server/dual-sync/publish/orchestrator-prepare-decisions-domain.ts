import { getDualSyncDecisionDisabledReason } from '../flag';
import { hashCanonicalJson } from '../hashing';
import { findFieldConfig, resolveFieldCapability } from '../registry';
import { groupKeyForDecision, isImport, policyFailure, valueForField } from './orchestrator-domain';
import { validatePublishDecisionPins } from './pinning';

import type { DualSyncRuntimeFlags } from '../flag';
import type { buildRegistry } from '../registry';
import type { DualSyncCanonicalSnapshot } from '../snapshots/types';
import type { DualSyncGoogleUpdateMask } from '../types';
import type { DualSyncOperationFailure, DualSyncPublishDecision } from './types';

export type PublishDecisionEvaluation =
  | {
      readonly status: 'failed';
      readonly fieldKey: string;
      readonly failure: DualSyncOperationFailure;
    }
  | {
      readonly status: 'ignored';
      readonly decision: DualSyncPublishDecision;
    }
  | {
      readonly status: 'ready';
      readonly decision: DualSyncPublishDecision;
      readonly beforeCoreHash: string | null;
      readonly beforeGbpHash: string | null;
      readonly direction: 'import_from_google' | 'export_to_google';
      readonly operationGroupKey: string | null;
      readonly writeGroup: string | null;
      readonly googleUpdateMask: DualSyncGoogleUpdateMask | null;
    };

export interface EvaluatePublishDecisionInput {
  readonly decision: DualSyncPublishDecision;
  readonly registry: ReturnType<typeof buildRegistry>;
  readonly coreSnapshot: DualSyncCanonicalSnapshot;
  readonly gbpSnapshot: DualSyncCanonicalSnapshot;
  readonly preflightFailure?: DualSyncOperationFailure;
  readonly runtimeFlags: DualSyncRuntimeFlags;
  readonly actorUserId: string | null;
}

export function evaluatePublishDecision({
  decision,
  registry,
  coreSnapshot,
  gbpSnapshot,
  preflightFailure,
  runtimeFlags,
  actorUserId,
}: EvaluatePublishDecisionInput): PublishDecisionEvaluation {
  const config = findFieldConfig(registry, decision.fieldKey);
  if (!config) {
    return {
      status: 'failed',
      fieldKey: decision.fieldKey,
      failure: {
        code: 'INVALID_DECISION',
        message: `Unknown field key ${decision.fieldKey}.`,
        retryable: false,
      },
    };
  }

  const pinValidationFailure = validatePublishDecisionPins(decision);
  if (pinValidationFailure) {
    return { status: 'failed', fieldKey: decision.fieldKey, failure: pinValidationFailure };
  }

  if (preflightFailure) {
    return { status: 'failed', fieldKey: decision.fieldKey, failure: preflightFailure };
  }

  const coreValue = valueForField(coreSnapshot, config, 'core');
  const gbpValue = valueForField(gbpSnapshot, config, 'gbp');
  const beforeCoreHash = hashCanonicalJson(config.canonicalizeCoreValue(coreValue));
  const beforeGbpHash = hashCanonicalJson(config.canonicalizeGbpValue(gbpValue));

  if (beforeCoreHash !== decision.pinnedCoreHash) {
    return {
      status: 'failed',
      fieldKey: decision.fieldKey,
      failure: {
        code: 'CORE_DRIFT',
        message: 'Core value moved since the operator viewed the diff.',
        retryable: false,
      },
    };
  }
  if (beforeGbpHash !== decision.pinnedGbpHash) {
    return {
      status: 'failed',
      fieldKey: decision.fieldKey,
      failure: {
        code: 'GBP_DRIFT',
        message: 'Google value moved since the operator viewed the diff.',
        retryable: false,
      },
    };
  }

  if (decision.sectionKey !== config.sectionKey) {
    return {
      status: 'failed',
      fieldKey: decision.fieldKey,
      failure: policyFailure(
        `Field ${decision.fieldKey} belongs to ${config.sectionKey}, not ${decision.sectionKey}.`,
        'INVALID_DECISION',
      ),
    };
  }

  const capability = resolveFieldCapability({ config, coreValue, gbpValue });
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
    return {
      status: 'failed',
      fieldKey: decision.fieldKey,
      failure: policyFailure(flagDisabledReason),
    };
  }

  if (decision.action === 'import_from_google' && !capability.canImport) {
    return {
      status: 'failed',
      fieldKey: decision.fieldKey,
      failure: policyFailure(
        capability.blockedReasons[0] ?? 'Field policy does not allow importing this field.',
      ),
    };
  }
  if (decision.action === 'export_to_google') {
    if (!capability.canExport) {
      return {
        status: 'failed',
        fieldKey: decision.fieldKey,
        failure: policyFailure(
          config.policy.noWriteReason ??
            config.exportBlockedReason ??
            capability.blockedReasons[0] ??
            'Field policy does not allow exporting this field.',
        ),
      };
    }
    if (config.policy.requiresManualReview && actorUserId === null) {
      return {
        status: 'failed',
        fieldKey: decision.fieldKey,
        failure: policyFailure('Field requires manual review before it can be exported.'),
      };
    }
    if (!config.policy.googleWriteGroup) {
      return {
        status: 'failed',
        fieldKey: decision.fieldKey,
        failure: policyFailure(
          config.policy.noWriteReason ?? 'Field policy has no Google write group.',
        ),
      };
    }
  }

  if (decision.action === 'ignore') {
    return { status: 'ignored', decision };
  }

  const direction = isImport(decision.action) ? 'import_from_google' : 'export_to_google';
  return {
    status: 'ready',
    decision,
    beforeCoreHash,
    beforeGbpHash,
    direction,
    operationGroupKey: groupKeyForDecision({ decision, config }),
    writeGroup: direction === 'export_to_google' ? (config.policy.googleWriteGroup ?? null) : null,
    googleUpdateMask: config.googleUpdateMask ?? null,
  };
}
