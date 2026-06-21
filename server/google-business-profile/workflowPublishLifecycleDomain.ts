import { selectedApprovalsWithDecisions } from './workflowFieldDecisions';
import { classifyGoogleBusinessProfilePushError } from './workflowPushErrors';

import type { GoogleBusinessProfileFieldDecision } from './workflow';
import type { GoogleBusinessProfileGoogleErrorClassification } from './workflowPushErrors';
import type { PublishJobRow } from './workflowRepository';
import type { Database } from '@/types/supabase';

const DEFAULT_GOOGLE_PUSH_ERROR_MESSAGE = 'Unable to push supported fields to Google.';

export type CompletedPublishJobOutcome = {
  readonly result: 'published' | 'partially_published';
  readonly nabatableEventId: string | null;
  readonly googleEventId: string | null;
};

export function resolveCompletedPublishJobOutcome(
  job: Pick<PublishJobRow, 'status' | 'nabatable_publish_event_id' | 'google_publish_event_id'>,
): CompletedPublishJobOutcome | null {
  if (job.status === 'published') {
    return {
      result: 'published',
      nabatableEventId: job.nabatable_publish_event_id,
      googleEventId: job.google_publish_event_id,
    };
  }

  if (job.status === 'partially_published' || job.status === 'google_failed') {
    return {
      result: 'partially_published',
      nabatableEventId: job.nabatable_publish_event_id,
      googleEventId: job.google_publish_event_id,
    };
  }

  return null;
}

export function buildDraftPublishingPatch(params: {
  readonly selectedApprovals: Record<string, boolean>;
  readonly decisions: ReadonlyArray<GoogleBusinessProfileFieldDecision>;
  readonly approvedAt: string | null;
  readonly approvedByUserId: string | null;
  readonly actorUserId: string;
  readonly nowIso: string;
}): Database['public']['Tables']['restaurant_external_profile_drafts']['Update'] {
  const patch: Database['public']['Tables']['restaurant_external_profile_drafts']['Update'] = {
    status: 'publishing',
    selected_approvals: selectedApprovalsWithDecisions(params.selectedApprovals, [
      ...params.decisions,
    ]),
  };

  if (!params.approvedAt) {
    patch.approved_at = params.nowIso;
  }
  if (!params.approvedByUserId) {
    patch.approved_by_user_id = params.actorUserId;
  }

  return patch;
}

export function describeWorkflowPublishError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    if (typeof record.message === 'string' && record.message.trim()) {
      return record.message;
    }
    if (typeof record.details === 'string' && record.details.trim()) {
      return record.details;
    }
  }

  return fallback;
}

export function classifyWorkflowGooglePushFailure(error: unknown): {
  readonly classification: GoogleBusinessProfileGoogleErrorClassification | null | undefined;
  readonly message: string;
  readonly retryable?: boolean;
  readonly reconciliationRequired?: boolean;
} {
  if (error && typeof error === 'object' && 'classification' in error) {
    const record = error as {
      classification?: GoogleBusinessProfileGoogleErrorClassification | null;
      retryable?: unknown;
      reconciliationRequired?: unknown;
    };
    return {
      classification: record.classification,
      message: describeWorkflowPublishError(error, DEFAULT_GOOGLE_PUSH_ERROR_MESSAGE),
      ...(typeof record.retryable === 'boolean' ? { retryable: record.retryable } : {}),
      ...(typeof record.reconciliationRequired === 'boolean'
        ? { reconciliationRequired: record.reconciliationRequired }
        : {}),
    };
  }

  return classifyGoogleBusinessProfilePushError(error);
}

export function hasNonRetryableGooglePushEvidence(errors: unknown): boolean {
  const values = Array.isArray(errors) ? errors : [errors];
  return values.some((value) => {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const record = value as { retryable?: unknown; reconciliationRequired?: unknown };
    return record.retryable === false || record.reconciliationRequired === true;
  });
}

export function extractGoogleEventIdFromPublishError(
  error: unknown,
  fallback: string | null,
): string | null {
  if (error && typeof error === 'object' && 'googleEventId' in error) {
    return String((error as { googleEventId?: unknown }).googleEventId);
  }

  return fallback;
}
