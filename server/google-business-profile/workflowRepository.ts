import { selectedApprovalsWithDecisions } from './workflowFieldDecisions';
import { toJson } from './workflowSerialization';
import { GOOGLE_RETRYABLE_JOB_STATUSES } from './workflowStatusValidation';

import type {
  GoogleBusinessProfileDraftItem,
  GoogleBusinessProfileDraftSectionKey,
  GoogleBusinessProfileFieldDecision,
  GoogleBusinessProfileGoogleUpdateMask,
  GoogleBusinessProfilePublishPreflightNotice,
  GoogleBusinessProfileWorkflowDraft,
} from './workflow';
import type {
  GoogleBusinessProfilePublishDirectionIntent,
  GoogleBusinessProfilePublishMode,
} from './workflowPublishDirection';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

export type DbClient = SupabaseClient<Database>;
export type ExternalProfileRow =
  Database['public']['Tables']['restaurant_external_profiles']['Row'];
export type DraftRow = Database['public']['Tables']['restaurant_external_profile_drafts']['Row'];
export type PublishEventRow =
  Database['public']['Tables']['restaurant_external_profile_publish_events']['Row'];
export type PublishJobRow =
  Database['public']['Tables']['restaurant_external_profile_publish_jobs']['Row'];

export const GOOGLE_BUSINESS_PROFILE_PROVIDER = 'google_business_profile';

export type WorkflowPublishEventDirection =
  | 'pull_from_gbp_to_nabatable'
  | 'push_from_nabatable_to_google';

export type WorkflowPublishEventResult = 'success' | 'failed' | 'partial' | 'skipped';

export type WorkflowPublishJobPreflightContext = {
  draft: Pick<GoogleBusinessProfileWorkflowDraft, 'id'>;
  externalProfile: Pick<ExternalProfileRow, 'id'> | null;
  mode: GoogleBusinessProfilePublishMode;
  directionIntent: GoogleBusinessProfilePublishDirectionIntent;
  selectedApprovals: Record<string, boolean>;
  decisions: GoogleBusinessProfileFieldDecision[];
  sections: GoogleBusinessProfileDraftSectionKey[];
  nabatableUpdates: GoogleBusinessProfileDraftItem[];
  googleUpdates: GoogleBusinessProfileDraftItem[];
  pullOnlyItems: GoogleBusinessProfileDraftItem[];
  googleUpdateMasks: GoogleBusinessProfileGoogleUpdateMask[];
  warnings: GoogleBusinessProfilePublishPreflightNotice[];
  errors: GoogleBusinessProfilePublishPreflightNotice[];
  idempotencyKey: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

function createWorkflowRepositoryError(name: string, message: string): Error {
  const error = new Error(message);
  error.name = name;
  return error;
}

export function isUniqueConstraintError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const record = error as Record<string, unknown>;
  const code = typeof record.code === 'string' ? record.code : '';
  const message = typeof record.message === 'string' ? record.message.toLowerCase() : '';
  const details = typeof record.details === 'string' ? record.details.toLowerCase() : '';

  return (
    code === '23505' ||
    message.includes('duplicate key') ||
    message.includes('unique constraint') ||
    details.includes('duplicate key') ||
    details.includes('unique constraint')
  );
}

export async function findExternalProfile(
  restaurantId: string,
  client: DbClient,
): Promise<ExternalProfileRow | null> {
  const { data, error } = await client
    .from('restaurant_external_profiles')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('provider', GOOGLE_BUSINESS_PROFILE_PROVIDER)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function readLatestDraft(
  restaurantId: string,
  client: DbClient,
): Promise<DraftRow | null> {
  const { data, error } = await client
    .from('restaurant_external_profile_drafts')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('provider', GOOGLE_BUSINESS_PROFILE_PROVIDER)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function readDraftById(
  restaurantId: string,
  draftId: string,
  client: DbClient,
): Promise<DraftRow | null> {
  const { data, error } = await client
    .from('restaurant_external_profile_drafts')
    .select('*')
    .eq('id', draftId)
    .eq('restaurant_id', restaurantId)
    .eq('provider', GOOGLE_BUSINESS_PROFILE_PROVIDER)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function readEvents(
  restaurantId: string,
  client: DbClient,
): Promise<PublishEventRow[]> {
  const { data, error } = await client
    .from('restaurant_external_profile_publish_events')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('provider', GOOGLE_BUSINESS_PROFILE_PROVIDER)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function readLatestPublishJob(
  restaurantId: string,
  client: DbClient,
): Promise<PublishJobRow | null> {
  const { data, error } = await client
    .from('restaurant_external_profile_publish_jobs')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('provider', GOOGLE_BUSINESS_PROFILE_PROVIDER)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function readPublishJobById(params: {
  restaurantId: string;
  draftId: string;
  publishJobId: string;
  client: DbClient;
}): Promise<PublishJobRow | null> {
  const { data, error } = await params.client
    .from('restaurant_external_profile_publish_jobs')
    .select('*')
    .eq('id', params.publishJobId)
    .eq('restaurant_id', params.restaurantId)
    .eq('draft_id', params.draftId)
    .eq('provider', GOOGLE_BUSINESS_PROFILE_PROVIDER)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function insertPublishEvent(params: {
  restaurantId: string;
  draftId: string;
  externalProfileId: string | null;
  direction: WorkflowPublishEventDirection;
  sections: GoogleBusinessProfileDraftSectionKey[];
  oldValues: unknown;
  newValues: unknown;
  googleUpdateMasks?: unknown;
  actorUserId: string;
  client: DbClient;
}): Promise<PublishEventRow> {
  const { data, error } = await params.client
    .from('restaurant_external_profile_publish_events')
    .insert({
      restaurant_id: params.restaurantId,
      draft_id: params.draftId,
      external_profile_id: params.externalProfileId,
      provider: GOOGLE_BUSINESS_PROFILE_PROVIDER,
      direction: params.direction,
      affected_sections: params.sections,
      old_values: toJson(params.oldValues),
      new_values: toJson(params.newValues),
      google_update_masks: toJson(params.googleUpdateMasks ?? []),
      result: 'pending',
      errors: [],
      actor_user_id: params.actorUserId,
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updatePublishEvent(
  eventId: string,
  result: WorkflowPublishEventResult,
  errors: unknown[],
  client: DbClient,
): Promise<void> {
  const { error } = await client
    .from('restaurant_external_profile_publish_events')
    .update({ result, errors: toJson(errors) })
    .eq('id', eventId);

  if (error) {
    throw error;
  }
}

export async function upsertPublishJobFromPreflight(params: {
  restaurantId: string;
  actorUserId: string;
  context: WorkflowPublishJobPreflightContext;
  client: DbClient;
}): Promise<PublishJobRow> {
  const { data: existingJob, error: existingError } = await params.client
    .from('restaurant_external_profile_publish_jobs')
    .select('*')
    .eq('idempotency_key', params.context.idempotencyKey)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }
  if (existingJob) {
    return existingJob;
  }

  const { data, error } = await params.client
    .from('restaurant_external_profile_publish_jobs')
    .insert({
      restaurant_id: params.restaurantId,
      draft_id: params.context.draft.id,
      external_profile_id: params.context.externalProfile?.id ?? null,
      provider: GOOGLE_BUSINESS_PROFILE_PROVIDER,
      idempotency_key: params.context.idempotencyKey,
      mode: params.context.mode,
      status: 'preflight_ready',
      selected_approvals: selectedApprovalsWithDecisions(
        params.context.selectedApprovals,
        params.context.decisions,
      ),
      nabatable_sections: params.context.sections,
      preflight_nabatable_updates: toJson(params.context.nabatableUpdates),
      preflight_pull_only_items: toJson(params.context.pullOnlyItems),
      google_update_masks: params.context.googleUpdateMasks,
      preflight_warnings: toJson(params.context.warnings),
      preflight_errors: toJson(params.context.errors),
      created_by_user_id: params.actorUserId,
      preflighted_at: nowIso(),
    })
    .select('*')
    .single();

  if (error) {
    if (isUniqueConstraintError(error)) {
      const { data: racedJob, error: racedReadError } = await params.client
        .from('restaurant_external_profile_publish_jobs')
        .select('*')
        .eq('idempotency_key', params.context.idempotencyKey)
        .maybeSingle();

      if (racedReadError) {
        throw racedReadError;
      }
      if (racedJob) {
        return racedJob;
      }
    }

    throw error;
  }

  return data;
}

export async function claimPublishJobForPublishing(params: {
  jobId: string;
  actorUserId: string;
  context: WorkflowPublishJobPreflightContext;
  client: DbClient;
}): Promise<PublishJobRow> {
  const { data, error } = await params.client
    .from('restaurant_external_profile_publish_jobs')
    .update({
      status: 'publishing',
      published_by_user_id: params.actorUserId,
      selected_approvals: selectedApprovalsWithDecisions(
        params.context.selectedApprovals,
        params.context.decisions,
      ),
      nabatable_sections: params.context.sections,
      preflight_nabatable_updates: toJson(params.context.nabatableUpdates),
      preflight_pull_only_items: toJson(params.context.pullOnlyItems),
      google_update_masks: params.context.googleUpdateMasks,
      preflight_warnings: toJson(params.context.warnings),
      preflight_errors: toJson(params.context.errors),
    })
    .eq('id', params.jobId)
    .eq('status', 'preflight_ready')
    .select('*')
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) {
    throw createWorkflowRepositoryError(
      'GBP_PUBLISH_JOB_INVALID_STATE',
      'Update is already being applied or is no longer ready to publish.',
    );
  }

  return data;
}

export async function claimPublishJobForGoogleRetry(params: {
  jobId: string;
  actorUserId: string;
  client: DbClient;
}): Promise<PublishJobRow> {
  const retriedAt = nowIso();
  const { data, error } = await params.client
    .from('restaurant_external_profile_publish_jobs')
    .update({
      status: 'publishing',
      google_retry_by_user_id: params.actorUserId,
      retried_at: retriedAt,
    })
    .eq('id', params.jobId)
    .in('status', GOOGLE_RETRYABLE_JOB_STATUSES)
    .select('*')
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) {
    throw createWorkflowRepositoryError(
      'GBP_PUBLISH_JOB_INVALID_STATE',
      'Google retry is already being applied or is no longer retryable.',
    );
  }

  return data;
}
