/**
 * Phase 3 of the GBP Dual-Sync V2 architecture.
 *
 * Preflight validator. Pure function: given the persisted draft, the live
 * decision set, and the requested direction intent, returns either a sealed
 * `SyncV2PreflightResult` plus the publish-job hashes, or an array of
 * blocking errors.
 *
 * Stale detection is per-decision (the decision's stored value hashes must
 * still match the live diff item's value hashes). Direction-policy legality
 * is per-decision-action via the diff item's capability flags.
 *
 * The frozen hashes returned here are written into
 * `gbp_sync_v2_publish_jobs` and re-checked at publish time so a tampered or
 * concurrently-modified decision set cannot publish.
 */

import { hashFrozenDecisions } from '../hashing';

import type {
  SyncV2Decision,
  SyncV2DiffItem,
  SyncV2DirectionIntent,
  SyncV2GoogleUpdateMask,
  SyncV2PreflightNotice,
  SyncV2PreflightResult,
  SyncV2SectionKey,
} from '../types';

export interface PreflightInput {
  readonly directionIntent: SyncV2DirectionIntent;
  readonly diffItems: ReadonlyArray<SyncV2DiffItem>;
  readonly decisions: ReadonlyArray<SyncV2Decision>;
  readonly nabatableSnapshotHash: string;
  readonly googleSnapshotHash: string;
  readonly googleWriteEligible: boolean;
}

export type PreflightOutcome =
  | { readonly ok: true; readonly result: SyncV2PreflightResult }
  | { readonly ok: false; readonly errors: ReadonlyArray<SyncV2PreflightNotice> };

function diffKey(sectionKey: SyncV2SectionKey, fieldKey: string): string {
  return `${sectionKey}::${fieldKey}`;
}

export function runPreflight({
  directionIntent,
  diffItems,
  decisions,
  nabatableSnapshotHash,
  googleSnapshotHash,
  googleWriteEligible,
}: PreflightInput): PreflightOutcome {
  const errors: SyncV2PreflightNotice[] = [];
  const warnings: SyncV2PreflightNotice[] = [];
  const diffByKey = new Map<string, SyncV2DiffItem>();
  for (const item of diffItems) {
    diffByKey.set(diffKey(item.sectionKey, item.fieldKey), item);
  }

  const planItems: Array<{
    readonly sectionKey: SyncV2SectionKey;
    readonly fieldKey: string;
    readonly action: SyncV2Decision['action'];
  }> = [];
  const masks = new Set<SyncV2GoogleUpdateMask>();

  for (const decision of decisions) {
    if (decision.action === 'ignore') continue;
    const item = diffByKey.get(diffKey(decision.sectionKey, decision.fieldKey));
    if (!item) {
      errors.push({
        code: 'V2_DECISION_HAS_NO_DIFF_ITEM',
        message: `Decision references a field that is no longer in the diff: ${decision.sectionKey}.${decision.fieldKey}.`,
        sectionKey: decision.sectionKey,
        fieldKey: decision.fieldKey,
      });
      continue;
    }
    if (
      decision.nabatableValueHash !== item.nabatableValueHash ||
      decision.googleValueHash !== item.googleValueHash
    ) {
      errors.push({
        code: 'V2_DECISION_STALE',
        message: `Decision is stale; underlying value changed since review: ${decision.sectionKey}.${decision.fieldKey}.`,
        sectionKey: decision.sectionKey,
        fieldKey: decision.fieldKey,
      });
      continue;
    }
    if (decision.action === 'import_from_google' && !item.capabilities.canImport) {
      errors.push({
        code: 'V2_DECISION_NOT_IMPORTABLE',
        message: `Field cannot be imported from Google: ${decision.sectionKey}.${decision.fieldKey}.`,
        sectionKey: decision.sectionKey,
        fieldKey: decision.fieldKey,
      });
      continue;
    }
    if (decision.action === 'export_to_google' && !item.capabilities.canExport) {
      errors.push({
        code: 'V2_DECISION_NOT_EXPORTABLE',
        message: `Field cannot be exported to Google: ${decision.sectionKey}.${decision.fieldKey}.`,
        sectionKey: decision.sectionKey,
        fieldKey: decision.fieldKey,
      });
      continue;
    }

    // Direction-intent legality: every selected action must be consistent
    // with the requested direction. Mixed directions in one publish are not
    // supported in V2 to keep audit and rollback semantics tractable.
    if (directionIntent === 'import_to_nabatable' && decision.action !== 'import_from_google') {
      errors.push({
        code: 'V2_DIRECTION_MISMATCH',
        message:
          'Selection contains an export-to-Google decision but direction intent is import_to_nabatable.',
        sectionKey: decision.sectionKey,
        fieldKey: decision.fieldKey,
      });
      continue;
    }
    if (directionIntent === 'export_to_google' && decision.action !== 'export_to_google') {
      errors.push({
        code: 'V2_DIRECTION_MISMATCH',
        message:
          'Selection contains an import-from-Google decision but direction intent is export_to_google.',
        sectionKey: decision.sectionKey,
        fieldKey: decision.fieldKey,
      });
      continue;
    }

    if (decision.action === 'export_to_google' && item.capabilities.googleUpdateMask) {
      masks.add(item.capabilities.googleUpdateMask);
    }
    planItems.push({
      sectionKey: decision.sectionKey,
      fieldKey: decision.fieldKey,
      action: decision.action,
    });
  }

  if (planItems.length === 0 && errors.length === 0) {
    errors.push({
      code: 'V2_NO_PUBLISHABLE_ITEMS',
      message: 'No decisions are publishable for the requested direction.',
    });
  }

  if (directionIntent === 'export_to_google' && !googleWriteEligible) {
    errors.push({
      code: 'V2_GOOGLE_WRITE_INELIGIBLE',
      message:
        'Export to Google is blocked because the connected Google account is not write-eligible (re-auth or permissions).',
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const frozen = decisions
    .filter((d) =>
      planItems.find((p) => p.sectionKey === d.sectionKey && p.fieldKey === d.fieldKey),
    )
    .map((d) => ({
      sectionKey: d.sectionKey,
      fieldKey: d.fieldKey,
      action: d.action,
      nabatableValueHash: d.nabatableValueHash,
      googleValueHash: d.googleValueHash,
    }));
  const frozenDecisionsHash = hashFrozenDecisions(frozen);

  return {
    ok: true,
    result: {
      directionIntent,
      publishablePlanItems: planItems,
      googleUpdateMasks: [...masks],
      warnings,
      errors,
      frozenDecisionsHash,
      frozenNabatableSnapshotHash: nabatableSnapshotHash,
      frozenGoogleSnapshotHash: googleSnapshotHash,
    },
  };
}
