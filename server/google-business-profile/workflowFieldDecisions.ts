import { toJson } from '@/server/google-business-profile/workflowSerialization';

import type { Json } from '@/types/supabase';

export const FIELD_DECISIONS_METADATA_KEY = '__fieldDecisions';

export type GoogleBusinessProfileSyncDecisionAction =
  | 'import_from_google'
  | 'export_to_google'
  | 'ignore';

export type GoogleBusinessProfileFieldDecision<SectionKey extends string = string> = {
  sectionKey: SectionKey;
  fieldKey: string;
  action: GoogleBusinessProfileSyncDecisionAction;
  decidedByUserId: string;
  decidedAt: string;
  reviewedNabatableValueHash: string;
  reviewedGoogleValueHash: string;
};

export type GoogleBusinessProfileFieldDecisionInput<SectionKey extends string = string> = {
  sectionKey: SectionKey;
  fieldKey: string;
  action: GoogleBusinessProfileSyncDecisionAction;
  reviewedNabatableValueHash: string;
  reviewedGoogleValueHash: string;
};

export function isGoogleProfileSyncDecisionAction(
  value: unknown,
): value is GoogleBusinessProfileSyncDecisionAction {
  return value === 'import_from_google' || value === 'export_to_google' || value === 'ignore';
}

export function normalizeFieldDecision<SectionKey extends string = string>(
  value: unknown,
): GoogleBusinessProfileFieldDecision<SectionKey> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (
    typeof record.sectionKey !== 'string' ||
    typeof record.fieldKey !== 'string' ||
    !isGoogleProfileSyncDecisionAction(record.action) ||
    typeof record.reviewedNabatableValueHash !== 'string' ||
    typeof record.reviewedGoogleValueHash !== 'string'
  ) {
    return null;
  }

  return {
    sectionKey: record.sectionKey as SectionKey,
    fieldKey: record.fieldKey,
    action: record.action,
    decidedByUserId:
      typeof record.decidedByUserId === 'string' ? record.decidedByUserId : 'unknown',
    decidedAt: typeof record.decidedAt === 'string' ? record.decidedAt : new Date().toISOString(),
    reviewedNabatableValueHash: record.reviewedNabatableValueHash,
    reviewedGoogleValueHash: record.reviewedGoogleValueHash,
  };
}

export function normalizeFieldDecisions<SectionKey extends string = string>(
  value: unknown,
): GoogleBusinessProfileFieldDecision<SectionKey>[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const byFieldKey = new Map<string, GoogleBusinessProfileFieldDecision<SectionKey>>();
  for (const entry of value) {
    const decision = normalizeFieldDecision<SectionKey>(entry);
    if (decision) {
      byFieldKey.set(decision.fieldKey, decision);
    }
  }
  return [...byFieldKey.values()];
}

export function extractFieldDecisions<SectionKey extends string = string>(
  value: Json | null,
): GoogleBusinessProfileFieldDecision<SectionKey>[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [];
  }

  return normalizeFieldDecisions<SectionKey>(
    (value as Record<string, unknown>)[FIELD_DECISIONS_METADATA_KEY],
  );
}

export function selectedApprovalsWithDecisions<SectionKey extends string = string>(
  selectedApprovals: Record<string, boolean>,
  decisions: GoogleBusinessProfileFieldDecision<SectionKey>[],
): Json {
  return toJson({
    ...selectedApprovals,
    ...(decisions.length > 0 ? { [FIELD_DECISIONS_METADATA_KEY]: decisions } : {}),
  });
}
