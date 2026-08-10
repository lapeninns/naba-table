import {
  EXACT_CONSENT_POLICY_VERSION,
  EXACT_CONSENT_RENDERER_VERSION,
  EXACT_CONSENT_VERSION,
} from './types';
import { hashCanonicalJson } from '../../hashing';

import type {
  ExactConsentGroupDraft,
  ExactConsentPreview,
  ExactConsentPreviewDraft,
  ExactConsentPreviewGroup,
  ExactConsentSideHashes,
  ExactConsentValueSides,
} from './types';

const PREVIEW_LIFETIME_MS = 15 * 60 * 1_000;

function requiredHash(value: unknown): string {
  return hashCanonicalJson(value) ?? hashCanonicalJson({ absent: true }) ?? '';
}

function hashesFor(
  fields: readonly string[],
  values: ExactConsentValueSides,
): ExactConsentSideHashes {
  const core = Object.fromEntries(fields.map((field) => [field, requiredHash(values.core[field])]));
  const google = Object.fromEntries(
    fields.map((field) => [field, requiredHash(values.google[field])]),
  );
  return { core: Object.freeze(core), google: Object.freeze(google) };
}

function buildGroup(
  draft: ExactConsentGroupDraft,
  decisions: readonly Readonly<Record<string, unknown>>[],
): ExactConsentPreviewGroup {
  const fieldKeys = Object.freeze([...new Set(draft.fieldKeys)].sort());
  const updateMasks = Object.freeze([...new Set(draft.updateMasks)].sort());
  const groupDecisions = decisions.filter((decision) => {
    const fieldKey = decision['fieldKey'];
    return typeof fieldKey === 'string' && fieldKeys.includes(fieldKey);
  });
  return Object.freeze({
    groupId: draft.groupId,
    writeGroup: draft.writeGroup,
    direction: 'export_to_google',
    fieldKeys,
    method: draft.method,
    resource: draft.resource,
    updateMasks,
    beforeDisplay: draft.before,
    afterDisplay: draft.after,
    beforeHashes: hashesFor(fieldKeys, draft.before),
    afterHashes: hashesFor(fieldKeys, draft.after),
    requestHash: requiredHash(draft.request),
    decisionHash: requiredHash(groupDecisions),
    warnings: Object.freeze([...draft.warnings]),
    riskLevel: draft.riskLevel,
    fullReplacement: draft.fullReplacement,
  });
}

export function previewFingerprintProjection(
  preview: Omit<ExactConsentPreview, 'planFingerprint' | 'issuedAt' | 'expiresAt'>,
): unknown {
  return {
    confirmationVersion: preview.confirmationVersion,
    policyVersion: preview.policyVersion,
    rendererVersion: preview.rendererVersion,
    listing: preview.listing,
    snapshotPins: preview.snapshotPins,
    groups: preview.groups.map((group) => ({
      groupId: group.groupId,
      writeGroup: group.writeGroup,
      direction: group.direction,
      fieldKeys: group.fieldKeys,
      method: group.method,
      resource: group.resource,
      updateMasks: group.updateMasks,
      beforeHashes: group.beforeHashes,
      afterHashes: group.afterHashes,
      requestHash: group.requestHash,
      decisionHash: group.decisionHash,
      warnings: group.warnings,
      riskLevel: group.riskLevel,
      fullReplacement: group.fullReplacement,
    })),
  };
}

export function buildExactConsentPreview(
  draft: ExactConsentPreviewDraft,
  options: { readonly clock?: () => Date } = {},
): ExactConsentPreview {
  const now = options.clock?.() ?? new Date();
  const base = Object.freeze({
    confirmationVersion: EXACT_CONSENT_VERSION,
    policyVersion: EXACT_CONSENT_POLICY_VERSION,
    rendererVersion: EXACT_CONSENT_RENDERER_VERSION,
    listing: Object.freeze({ ...draft.listing }),
    snapshotPins: Object.freeze({ ...draft.snapshotPins }),
    groups: Object.freeze(draft.groups.map((group) => buildGroup(group, draft.decisions))),
  });
  return Object.freeze({
    ...base,
    planFingerprint: requiredHash(previewFingerprintProjection(base)),
    issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + PREVIEW_LIFETIME_MS).toISOString(),
  });
}
