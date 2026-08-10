import { readGoogleBusinessProfileBusinessInfo } from './business-info';
import { syncGoogleBusinessProfileBusinessInformation } from './service';
import { buildDraftSections } from './workflowDraftSections';
import { validateAndStampFieldDecisions } from './workflowDraftSelection';
import {
  reconcileDraftWithCurrentSections,
  selectedApprovalsFromDecisions,
  suppressActionsForReadOnlyReview,
} from './workflowDraftState';
import { extractFieldDecisions, selectedApprovalsWithDecisions } from './workflowFieldDecisions';
import { buildCoreSnapshotHashes, buildWorkflowResponse, mapDraft } from './workflowMappers';
import { readCoreSnapshots, resolveCanPushServicePeriods } from './workflowPreflightContext';
import {
  findExternalProfile,
  GOOGLE_BUSINESS_PROFILE_PROVIDER,
  readDraftById,
  readEvents,
  readLatestDraft,
  readLatestPublishJob,
  type DbClient,
} from './workflowRepository';
import { toJson } from './workflowSerialization';
import {
  assertDraftEditable,
  createDraftStateError,
  EDITABLE_DRAFT_STATUSES,
  READ_ONLY_REVIEW_DRAFT_STATUSES,
} from './workflowStatusValidation';

import type {
  GoogleBusinessProfileDraftSectionKey,
  GoogleBusinessProfileFieldDecisionInput,
  GoogleBusinessProfileWorkflowResponse,
} from './workflow';
import type { Database } from '@/types/supabase';

function nowIso(): string {
  return new Date().toISOString();
}

export async function getGoogleBusinessProfileWorkflowState(
  restaurantId: string,
  client: DbClient,
): Promise<GoogleBusinessProfileWorkflowResponse> {
  const [draft, events, activePublishJob] = await Promise.all([
    readLatestDraft(restaurantId, client),
    readEvents(restaurantId, client),
    readLatestPublishJob(restaurantId, client),
  ]);
  let latestDraft = draft ? mapDraft(draft) : null;

  if (latestDraft) {
    const [externalProfile, core, businessInfo] = await Promise.all([
      findExternalProfile(restaurantId, client),
      readCoreSnapshots(restaurantId, client),
      readGoogleBusinessProfileBusinessInfo(restaurantId, client),
    ]);
    const currentSections = buildDraftSections({
      core,
      businessInfo,
      externalLocationTitle: externalProfile?.external_location_title ?? null,
      canPushServicePeriods: resolveCanPushServicePeriods({
        core,
        businessInfo,
        lastPulledAt: externalProfile?.last_pull_at ?? null,
        lastPushedAt: externalProfile?.last_push_at ?? null,
      }),
    });
    latestDraft = READ_ONLY_REVIEW_DRAFT_STATUSES.includes(latestDraft.status)
      ? suppressActionsForReadOnlyReview(latestDraft)
      : reconcileDraftWithCurrentSections(latestDraft, currentSections);
  }

  return buildWorkflowResponse(latestDraft, events, activePublishJob);
}

export async function createGoogleBusinessProfileWorkflowDraftState(params: {
  restaurantId: string;
  actorUserId: string;
  client: DbClient;
}): Promise<GoogleBusinessProfileWorkflowResponse> {
  const refreshedConnection = await syncGoogleBusinessProfileBusinessInformation(
    params.restaurantId,
    params.client,
  );
  const [externalProfile, core] = await Promise.all([
    findExternalProfile(params.restaurantId, params.client),
    readCoreSnapshots(params.restaurantId, params.client),
  ]);

  const fetchedAt = nowIso();

  const { data, error } = await params.client
    .from('restaurant_external_profile_drafts')
    .insert({
      restaurant_id: params.restaurantId,
      external_profile_id: externalProfile?.id ?? null,
      provider: GOOGLE_BUSINESS_PROFILE_PROVIDER,
      status: 'review_ready',
      source_snapshot_refs: toJson({
        externalProfileId: externalProfile?.id ?? null,
        externalLocationName: refreshedConnection.externalLocationName,
        lastPullAt: refreshedConnection.lastPullAt,
        lastPushAt: refreshedConnection.lastPushAt,
      }),
      section_diffs: [],
      selected_approvals: {},
      core_snapshot_hashes: toJson(buildCoreSnapshotHashes(core)),
      stale_sections: [],
      conflict_metadata: {},
      created_by_user_id: params.actorUserId,
      fetched_at: fetchedAt,
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  const { error: archiveError } = await params.client
    .from('restaurant_external_profile_drafts')
    .update({ status: 'archived' })
    .eq('restaurant_id', params.restaurantId)
    .eq('provider', GOOGLE_BUSINESS_PROFILE_PROVIDER)
    .neq('id', data.id)
    .in('status', ['review_ready', 'approved', 'stale', 'failed', 'partially_published']);
  if (archiveError) {
    throw archiveError;
  }

  const [events, activePublishJob] = await Promise.all([
    readEvents(params.restaurantId, params.client),
    readLatestPublishJob(params.restaurantId, params.client),
  ]);
  return buildWorkflowResponse(mapDraft(data), events, activePublishJob);
}

export async function updateGoogleBusinessProfileWorkflowDraftState(params: {
  restaurantId: string;
  draftId: string;
  actorUserId: string;
  selectedApprovals?: Record<string, boolean>;
  decisions?: GoogleBusinessProfileFieldDecisionInput[];
  status?: 'review_ready' | 'approved';
  client: DbClient;
}): Promise<GoogleBusinessProfileWorkflowResponse> {
  const currentDraft = await readDraftById(params.restaurantId, params.draftId, params.client);
  if (!currentDraft) {
    throw new Error('Google Business Profile review was not found.');
  }
  assertDraftEditable(currentDraft.status);
  const mappedDraft = mapDraft(currentDraft);
  const decisions =
    params.decisions !== undefined
      ? validateAndStampFieldDecisions({
          draft: mappedDraft,
          decisions: params.decisions,
          actorUserId: params.actorUserId,
          decidedAt: nowIso(),
        })
      : extractFieldDecisions<GoogleBusinessProfileDraftSectionKey>(
          currentDraft.selected_approvals,
        );
  const selectedApprovals =
    params.decisions !== undefined
      ? selectedApprovalsFromDecisions(decisions)
      : params.selectedApprovals;

  const patch: Database['public']['Tables']['restaurant_external_profile_drafts']['Update'] = {};
  if (selectedApprovals) {
    patch.selected_approvals = selectedApprovalsWithDecisions(selectedApprovals, decisions);
  }
  const selectionChanged = params.decisions !== undefined || params.selectedApprovals !== undefined;
  if (currentDraft.status === 'approved' && selectionChanged && params.status !== 'approved') {
    patch.status = 'review_ready';
    patch.approved_by_user_id = null;
    patch.approved_at = null;
  }
  if (params.status) {
    patch.status = params.status;
    if (params.status === 'approved') {
      patch.approved_by_user_id = params.actorUserId;
      patch.approved_at = nowIso();
    } else {
      patch.approved_by_user_id = null;
      patch.approved_at = null;
    }
  }

  const { data, error } = await params.client
    .from('restaurant_external_profile_drafts')
    .update(patch)
    .eq('id', params.draftId)
    .eq('restaurant_id', params.restaurantId)
    .eq('provider', GOOGLE_BUSINESS_PROFILE_PROVIDER)
    .in('status', EDITABLE_DRAFT_STATUSES)
    .select('*')
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) {
    throw createDraftStateError(currentDraft.status, 'edit');
  }

  const [events, activePublishJob] = await Promise.all([
    readEvents(params.restaurantId, params.client),
    readLatestPublishJob(params.restaurantId, params.client),
  ]);
  return buildWorkflowResponse(mapDraft(data), events, activePublishJob);
}
