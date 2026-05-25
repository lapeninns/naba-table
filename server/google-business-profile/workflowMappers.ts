import { applySelectedApprovals } from './workflowDraftState';
import { extractFieldDecisions } from './workflowFieldDecisions';
import { normalizeGoogleMasks } from './workflowGoogleUpdateMasks';
import {
  directionIntentForPublishMode,
  type GoogleBusinessProfilePublishMode,
} from './workflowPublishDirection';
import { hashJson, toObjectRecord, toStringRecord } from './workflowSerialization';
import { GOOGLE_RETRYABLE_JOB_STATUSES } from './workflowStatusValidation';

import type {
  GoogleBusinessProfileActivePublishJob,
  GoogleBusinessProfileDraftSection,
  GoogleBusinessProfileDraftSectionKey,
  GoogleBusinessProfileFieldDecision,
  GoogleBusinessProfileGoogleErrorClassification,
  GoogleBusinessProfileWorkflowAuditEvent,
  GoogleBusinessProfileWorkflowDraft,
  GoogleBusinessProfileWorkflowResponse,
} from './workflow';
import type { GoogleBusinessProfileWorkflowCoreSnapshots } from './workflowDraftSections';
import type { Database } from '@/types/supabase';

type DraftRow = Database['public']['Tables']['restaurant_external_profile_drafts']['Row'];
type PublishEventRow =
  Database['public']['Tables']['restaurant_external_profile_publish_events']['Row'];
type PublishJobRow =
  Database['public']['Tables']['restaurant_external_profile_publish_jobs']['Row'];

export function buildCoreSnapshotHashes(
  core: GoogleBusinessProfileWorkflowCoreSnapshots,
): Record<GoogleBusinessProfileDraftSectionKey, string> {
  return {
    profile: hashJson({
      name: core.profile.name,
      contactPhone: core.profile.contactPhone,
      address: core.profile.address,
      googleMapUrl: core.profile.googleMapUrl,
      googleReviewUrl: core.profile.googleReviewUrl,
    }),
    operatingHours: hashJson({
      weekly: core.operatingHours.weekly,
      overrides: core.operatingHours.overrides,
    }),
    servicePeriods: hashJson(core.servicePeriods),
    'businessContext.categories': hashJson(core.businessContext.core.categories),
    'businessContext.serviceAreas': hashJson(core.businessContext.core.serviceAreas),
    'businessContext.attributes': hashJson(core.businessContext.core.attributes),
    'businessContext.serviceItems': hashJson(core.businessContext.core.serviceItems),
  };
}

export function mapDraft(
  row: DraftRow,
  selectedApprovalsOverride?: Record<string, boolean>,
  decisionsOverride?: GoogleBusinessProfileFieldDecision[],
): GoogleBusinessProfileWorkflowDraft {
  const selectedApprovals = selectedApprovalsOverride ?? toObjectRecord(row.selected_approvals);
  const decisions =
    decisionsOverride ??
    extractFieldDecisions<GoogleBusinessProfileDraftSectionKey>(row.selected_approvals);
  const rawSections = Array.isArray(row.section_diffs)
    ? (row.section_diffs as unknown as GoogleBusinessProfileDraftSection[])
    : [];

  return {
    id: row.id,
    status: row.status,
    fetchedAt: row.fetched_at,
    approvedAt: row.approved_at,
    publishedAt: row.published_at,
    staleSections: row.stale_sections ?? [],
    conflictMetadata: row.conflict_metadata,
    selectedApprovals,
    decisions,
    sourceSnapshotRefs: row.source_snapshot_refs,
    coreSnapshotHashes:
      row.core_snapshot_hashes &&
      typeof row.core_snapshot_hashes === 'object' &&
      !Array.isArray(row.core_snapshot_hashes)
        ? (row.core_snapshot_hashes as Record<string, string>)
        : {},
    sectionDiffs: applySelectedApprovals(
      rawSections,
      selectedApprovals,
      row.stale_sections ?? [],
      decisions,
    ),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapEvent(row: PublishEventRow): GoogleBusinessProfileWorkflowAuditEvent {
  const flow =
    row.direction === 'push_from_nabatable_to_google'
      ? 'nabatable_to_google_sync'
      : 'google_to_nabatable_apply';
  return {
    id: row.id,
    draftId: row.draft_id,
    direction: row.direction,
    flow,
    directionLabel:
      flow === 'nabatable_to_google_sync' ? 'Legacy Google write' : 'Google -> Nabatable apply',
    affectedSections: row.affected_sections ?? [],
    googleUpdateMasks: row.google_update_masks,
    result: row.result,
    errors: row.errors,
    createdAt: row.created_at,
  };
}

export function mapPublishJob(row: PublishJobRow): GoogleBusinessProfileActivePublishJob {
  const googleUpdateMasks = normalizeGoogleMasks(row.google_update_masks);
  const mode = row.mode as GoogleBusinessProfilePublishMode;
  const canRetryGooglePush =
    mode !== 'nabatable_only' &&
    googleUpdateMasks.length > 0 &&
    GOOGLE_RETRYABLE_JOB_STATUSES.includes(row.status);

  return {
    id: row.id,
    draftId: row.draft_id,
    idempotencyKey: row.idempotency_key,
    mode,
    directionIntent: directionIntentForPublishMode(mode),
    status: row.status,
    selectedApprovals: toObjectRecord(row.selected_approvals),
    decisions: extractFieldDecisions<GoogleBusinessProfileDraftSectionKey>(row.selected_approvals),
    nabatableSections: row.nabatable_sections ?? [],
    googleUpdateMasks,
    postNabatableCoreHashes: toStringRecord(row.post_nabatable_core_hashes),
    errorClassification:
      row.error_classification as GoogleBusinessProfileGoogleErrorClassification | null,
    errors: row.errors,
    nabatableEventId: row.nabatable_publish_event_id,
    googleEventId: row.google_publish_event_id,
    canRetryGooglePush,
    retryBlockedReason: canRetryGooglePush
      ? null
      : mode === 'nabatable_only'
        ? 'This update applied Google changes to Nabatable only.'
        : googleUpdateMasks.length === 0
          ? 'No supported Google fields were selected for this update.'
          : 'Google retry is available only for failed or partial Google updates.',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function buildWorkflowResponse(
  latestDraft: GoogleBusinessProfileWorkflowDraft | null,
  events: PublishEventRow[],
  activePublishJob: PublishJobRow | null,
): GoogleBusinessProfileWorkflowResponse {
  const sectionSummaries =
    latestDraft?.sectionDiffs.map((section) => ({
      sectionKey: section.sectionKey,
      label: section.label,
      status: section.status,
      selectedCount: section.items.filter((item) => item.selected).length,
      itemCount: section.items.length,
    })) ?? [];

  return {
    latestDraft,
    sectionSummaries,
    publishableSections:
      latestDraft?.sectionDiffs
        .filter((section) => section.canPublishToNabatable)
        .map((section) => section.sectionKey) ?? [],
    blockedReasons: [
      ...(latestDraft?.staleSections.length
        ? ['Some profile sections changed since review. Check for changes again before applying.']
        : []),
      ...(latestDraft?.sectionDiffs.flatMap((section) => section.blockedReasons) ?? []),
    ],
    auditEvents: events.map(mapEvent),
    activePublishJob: activePublishJob ? mapPublishJob(activePublishJob) : null,
  };
}
