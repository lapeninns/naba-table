import { getGoogleBusinessProfileWorkflowState } from './workflowDraftLifecycle';
import { selectedSectionKeys } from './workflowDraftSelection';
import { extractFieldDecisions } from './workflowFieldDecisions';
import { normalizeGoogleMasks } from './workflowGoogleUpdateMasks';
import { buildCoreSnapshotHashes, mapDraft } from './workflowMappers';
import { readCoreSnapshots } from './workflowPreflightContext';
import { pushDraftToGoogle } from './workflowPublishExecution';
import {
  classifyWorkflowGooglePushFailure,
  extractGoogleEventIdFromPublishError,
  hasNonRetryableGooglePushEvidence,
} from './workflowPublishLifecycleDomain';
import { assertGooglePushEnabled, createWorkflowNamedError } from './workflowPublishPreflight';
import {
  claimPublishJobForGoogleRetry,
  findExternalProfile,
  readDraftById,
  readPublishJobById,
  type DbClient,
} from './workflowRepository';
import { toJson, toObjectRecord, toStringRecord } from './workflowSerialization';
import { GOOGLE_RETRYABLE_JOB_STATUSES } from './workflowStatusValidation';

import type {
  GoogleBusinessProfileDraftSectionKey,
  RetryGoogleBusinessProfilePushResult,
} from './workflow';

function nowIso(): string {
  return new Date().toISOString();
}

async function loadChangedPostNabatableSections(params: {
  restaurantId: string;
  client: DbClient;
  storedHashes: Record<string, string>;
  sections: readonly GoogleBusinessProfileDraftSectionKey[];
}): Promise<GoogleBusinessProfileDraftSectionKey[]> {
  const currentHashes: Record<string, string> = buildCoreSnapshotHashes(
    await readCoreSnapshots(params.restaurantId, params.client),
  );

  return params.sections.filter(
    (section) => params.storedHashes[section] !== currentHashes[section],
  );
}

function createCoreChangedRetryError(sections: readonly GoogleBusinessProfileDraftSectionKey[]) {
  return createWorkflowNamedError(
    'GBP_PUBLISH_JOB_CORE_CHANGED',
    `Cannot retry Google because Nabatable details changed after the update: ${sections.join(', ')}.`,
  );
}

export async function retryGoogleBusinessProfileWorkflowGooglePushState(params: {
  restaurantId: string;
  draftId: string;
  publishJobId: string;
  actorUserId: string;
  client: DbClient;
}): Promise<RetryGoogleBusinessProfilePushResult> {
  const { client } = params;
  let job = await readPublishJobById({
    restaurantId: params.restaurantId,
    draftId: params.draftId,
    publishJobId: params.publishJobId,
    client,
  });
  if (!job) {
    throw createWorkflowNamedError('GBP_PUBLISH_JOB_NOT_FOUND', 'Update was not found.');
  }
  const googleUpdateMasks = normalizeGoogleMasks(job.google_update_masks);
  if (
    (job.mode !== 'nabatable_and_google' && job.mode !== 'google_only') ||
    googleUpdateMasks.length === 0 ||
    !GOOGLE_RETRYABLE_JOB_STATUSES.includes(job.status) ||
    hasNonRetryableGooglePushEvidence(job.errors)
  ) {
    throw createWorkflowNamedError(
      'GBP_PUBLISH_JOB_INVALID_STATE',
      'Google retry is only available for failed or partial Google updates.',
    );
  }

  const draftRow = await readDraftById(params.restaurantId, params.draftId, client);
  if (!draftRow) {
    throw new Error('Google Business Profile review was not found.');
  }
  const selectedApprovals = toObjectRecord(job.selected_approvals);
  const draft = mapDraft(
    draftRow,
    selectedApprovals,
    extractFieldDecisions<GoogleBusinessProfileDraftSectionKey>(job.selected_approvals),
  );
  const retryCore = await readCoreSnapshots(params.restaurantId, params.client);
  const storedHashes = toStringRecord(job.post_nabatable_core_hashes);
  const postNabatableSections: GoogleBusinessProfileDraftSectionKey[] = [
    ...new Set<GoogleBusinessProfileDraftSectionKey>([
      ...((job.nabatable_sections ?? []) as GoogleBusinessProfileDraftSectionKey[]),
      ...selectedSectionKeys(draft, 'google_only'),
    ]),
  ];
  const changedSections = await loadChangedPostNabatableSections({
    restaurantId: params.restaurantId,
    client,
    storedHashes,
    sections: postNabatableSections,
  });

  if (changedSections.length > 0) {
    throw createCoreChangedRetryError(changedSections);
  }

  const externalProfile = await findExternalProfile(params.restaurantId, client);
  assertGooglePushEnabled(externalProfile);
  job = await claimPublishJobForGoogleRetry({
    jobId: job.id,
    actorUserId: params.actorUserId,
    client,
  });
  const changedSectionsAfterClaim = await loadChangedPostNabatableSections({
    restaurantId: params.restaurantId,
    client,
    storedHashes,
    sections: postNabatableSections,
  });

  if (changedSectionsAfterClaim.length > 0) {
    const error = createCoreChangedRetryError(changedSectionsAfterClaim);
    const { error: staleUpdateError } = await client
      .from('restaurant_external_profile_publish_jobs')
      .update({
        status: 'google_failed',
        google_retry_by_user_id: params.actorUserId,
        retried_at: nowIso(),
        error_classification: null,
        errors: toJson([
          {
            message: error.message,
            classification: null,
            retryable: false,
            reconciliationRequired: true,
          },
        ]),
      })
      .eq('id', job.id);
    if (staleUpdateError) {
      throw staleUpdateError;
    }
    throw error;
  }

  let googleEventId: string | null = null;
  try {
    googleEventId = await pushDraftToGoogle({
      restaurantId: params.restaurantId,
      draft,
      externalProfile,
      actorUserId: params.actorUserId,
      googleUpdateMasks,
      currentCore: retryCore,
      client,
    });
  } catch (error) {
    const classified = classifyWorkflowGooglePushFailure(error);
    googleEventId = extractGoogleEventIdFromPublishError(error, job.google_publish_event_id);
    const { error: retryFailureUpdateError } = await client
      .from('restaurant_external_profile_publish_jobs')
      .update({
        status: 'google_failed',
        google_publish_event_id: googleEventId,
        google_retry_by_user_id: params.actorUserId,
        retried_at: nowIso(),
        error_classification:
          classified.classification === undefined ? 'retryable' : classified.classification,
        errors: toJson([classified]),
      })
      .eq('id', job.id);
    if (retryFailureUpdateError) {
      throw retryFailureUpdateError;
    }
    throw error;
  }

  const pushedAt = nowIso();
  try {
    const { error: jobUpdateError } = await client
      .from('restaurant_external_profile_publish_jobs')
      .update({
        status: 'published',
        google_publish_event_id: googleEventId,
        google_pushed_at: pushedAt,
        google_retry_by_user_id: params.actorUserId,
        retried_at: pushedAt,
        error_classification: null,
        errors: [],
      })
      .eq('id', job.id);
    if (jobUpdateError) {
      throw jobUpdateError;
    }
    const { error: draftUpdateError } = await client
      .from('restaurant_external_profile_drafts')
      .update({
        status: 'published',
        published_by_user_id: params.actorUserId,
        published_at: pushedAt,
      })
      .eq('id', draft.id);
    if (draftUpdateError) {
      throw draftUpdateError;
    }
    return {
      ...(await getGoogleBusinessProfileWorkflowState(params.restaurantId, client)),
      googleEventId,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Local status update failed after Google publish succeeded.';
    const { error: retryFailureUpdateError } = await client
      .from('restaurant_external_profile_publish_jobs')
      .update({
        status: 'failed',
        google_publish_event_id: googleEventId,
        google_retry_by_user_id: params.actorUserId,
        retried_at: pushedAt,
        error_classification: null,
        errors: toJson([
          {
            message,
            classification: null,
            retryable: false,
            reconciliationRequired: true,
          },
        ]),
      })
      .eq('id', job.id);
    if (retryFailureUpdateError) {
      throw retryFailureUpdateError;
    }
    throw error;
  }
}
