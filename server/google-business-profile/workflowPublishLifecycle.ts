import { getGoogleBusinessProfileWorkflowState } from './workflowDraftLifecycle';
import { selectedSectionKeys } from './workflowDraftSelection';
import { extractFieldDecisions } from './workflowFieldDecisions';
import { buildCoreSnapshotHashes } from './workflowMappers';
import { buildPublishPreflightContext, readCoreSnapshots } from './workflowPreflightContext';
import {
  directionIntentForPublishMode,
  normalizePublishDirectionIntent,
  type GoogleBusinessProfilePublishDirectionIntent,
  type GoogleBusinessProfilePublishMode,
} from './workflowPublishDirection';
import {
  publishDraftToNabatable,
  pushDraftToGoogle,
  restoreCoreSnapshotAfterFailedPublish,
} from './workflowPublishExecution';
import {
  buildDraftPublishingPatch,
  classifyWorkflowGooglePushFailure,
  extractGoogleEventIdFromPublishError,
  resolveCompletedPublishJobOutcome,
} from './workflowPublishLifecycleDomain';
import { createWorkflowNamedError } from './workflowPublishPreflight';
import {
  claimPublishJobForPublishing,
  GOOGLE_BUSINESS_PROFILE_PROVIDER,
  readPublishJobById,
  upsertPublishJobFromPreflight,
  type DbClient,
  type PublishJobRow,
} from './workflowRepository';
import { buildFailedPublishErrors } from './workflowRollbackPayloads';
import { toJson, toObjectRecord } from './workflowSerialization';
import { formatDraftStatus } from './workflowStatusValidation';

import type {
  GoogleBusinessProfileDraftSectionKey,
  GoogleBusinessProfileFieldDecisionInput,
  GoogleBusinessProfileWorkflowDraft,
  GoogleBusinessProfileWorkflowResponse,
  PublishGoogleBusinessProfileDraftResult,
} from './workflow';

export { retryGoogleBusinessProfileWorkflowGooglePushState } from './workflowPublishRetryService';

const PROVIDER = GOOGLE_BUSINESS_PROFILE_PROVIDER;

function nowIso(): string {
  return new Date().toISOString();
}

async function readWorkflow(
  restaurantId: string,
  client: DbClient,
): Promise<GoogleBusinessProfileWorkflowResponse> {
  return getGoogleBusinessProfileWorkflowState(restaurantId, client);
}

async function loadChangedGooglePushSections(params: {
  restaurantId: string;
  client: DbClient;
  draft: GoogleBusinessProfileWorkflowDraft;
  expectedHashes: Record<GoogleBusinessProfileDraftSectionKey, string>;
}): Promise<GoogleBusinessProfileDraftSectionKey[]> {
  const currentHashes = buildCoreSnapshotHashes(
    await readCoreSnapshots(params.restaurantId, params.client),
  );
  return selectedSectionKeys(params.draft, 'google_only').filter(
    (section) => params.expectedHashes[section] !== currentHashes[section],
  );
}

function createCoreChangedPublishError(sections: readonly GoogleBusinessProfileDraftSectionKey[]) {
  return createWorkflowNamedError(
    'GBP_PUBLISH_JOB_CORE_CHANGED',
    `Cannot publish Google because Nabatable details changed after the final check: ${sections.join(', ')}.`,
  );
}

export async function publishGoogleBusinessProfileWorkflowDraftState(params: {
  restaurantId: string;
  draftId: string;
  actorUserId: string;
  directionIntent?: GoogleBusinessProfilePublishDirectionIntent;
  pushToGoogle?: boolean;
  publishJobId?: string;
  publishPlanId?: string;
  idempotencyKey?: string;
  selectedApprovals?: Record<string, boolean>;
  decisions?: GoogleBusinessProfileFieldDecisionInput[];
  client: DbClient;
}): Promise<PublishGoogleBusinessProfileDraftResult> {
  const { client } = params;
  let job: PublishJobRow | null = null;
  const publishJobId = params.publishPlanId ?? params.publishJobId;
  if (publishJobId) {
    job = await readPublishJobById({
      restaurantId: params.restaurantId,
      draftId: params.draftId,
      publishJobId,
      client,
    });
    if (!job) {
      throw createWorkflowNamedError('GBP_PUBLISH_JOB_NOT_FOUND', 'Update was not found.');
    }
    if (params.idempotencyKey && job.idempotency_key !== params.idempotencyKey) {
      throw createWorkflowNamedError(
        'GBP_PUBLISH_JOB_MISMATCH',
        'Update confirmation no longer matches the final check.',
      );
    }
    if (params.directionIntent || params.pushToGoogle !== undefined) {
      const requestedIntent = normalizePublishDirectionIntent({
        directionIntent: params.directionIntent,
        pushToGoogle: params.pushToGoogle,
      });
      const jobIntent = directionIntentForPublishMode(job.mode as GoogleBusinessProfilePublishMode);
      if (requestedIntent !== jobIntent) {
        throw createWorkflowNamedError(
          'GBP_DIRECTION_CONFLICT',
          'Update path does not match the final check.',
        );
      }
    }
  }

  const selectedApprovals =
    params.selectedApprovals ?? (job ? toObjectRecord(job.selected_approvals) : {});
  const jobDecisions = job
    ? extractFieldDecisions<GoogleBusinessProfileDraftSectionKey>(job.selected_approvals)
    : [];
  const directionIntent = job
    ? directionIntentForPublishMode(job.mode as GoogleBusinessProfilePublishMode)
    : normalizePublishDirectionIntent({
        directionIntent: params.directionIntent,
        pushToGoogle: params.pushToGoogle,
      });
  const context = await buildPublishPreflightContext({
    restaurantId: params.restaurantId,
    draftId: params.draftId,
    selectedApprovals,
    decisions: jobDecisions.length > 0 ? jobDecisions : params.decisions,
    actorUserId: params.actorUserId,
    directionIntent,
    client,
  });

  if (!job) {
    job = await upsertPublishJobFromPreflight({
      restaurantId: params.restaurantId,
      actorUserId: params.actorUserId,
      context,
      client,
    });
  }
  if (job.idempotency_key !== context.idempotencyKey) {
    throw createWorkflowNamedError(
      'GBP_PUBLISH_JOB_MISMATCH',
      'Update no longer matches the current final check.',
    );
  }
  const completedOutcome = resolveCompletedPublishJobOutcome(job);
  if (completedOutcome) {
    const response = await readWorkflow(params.restaurantId, client);
    return {
      ...response,
      ...completedOutcome,
    };
  }
  if (job.status !== 'preflight_ready') {
    throw createWorkflowNamedError(
      'GBP_PUBLISH_JOB_INVALID_STATE',
      `Update is ${formatDraftStatus(job.status)} and cannot be applied.`,
    );
  }

  // Preserve the Step 1 approval timestamp/actor when present; only stamp them
  // here if recovery flows reach publish without an explicit approval row (e.g.
  // legacy drafts that predate the strict two-step contract).
  const draftPublishingPatch = buildDraftPublishingPatch({
    selectedApprovals: context.selectedApprovals,
    decisions: context.decisions,
    approvedAt: context.draftRow.approved_at,
    approvedByUserId: context.draftRow.approved_by_user_id,
    actorUserId: params.actorUserId,
    nowIso: nowIso(),
  });
  job = await claimPublishJobForPublishing({
    jobId: job.id,
    actorUserId: params.actorUserId,
    context,
    client,
  });

  const { error: draftUpdateError } = await client
    .from('restaurant_external_profile_drafts')
    .update(draftPublishingPatch)
    .eq('id', context.draft.id)
    .eq('restaurant_id', params.restaurantId)
    .eq('provider', PROVIDER);
  if (draftUpdateError) {
    throw draftUpdateError;
  }

  let nabatableEventId: string | null = null;
  let postNabatableHashes: Record<GoogleBusinessProfileDraftSectionKey, string>;
  if (context.mode === 'google_only') {
    postNabatableHashes = context.currentHashes;
    const { error: jobNabatableError } = await client
      .from('restaurant_external_profile_publish_jobs')
      .update({
        post_nabatable_core_hashes: toJson(postNabatableHashes),
      })
      .eq('id', job.id);
    if (jobNabatableError) {
      throw jobNabatableError;
    }
  } else {
    try {
      nabatableEventId = await publishDraftToNabatable({
        restaurantId: params.restaurantId,
        draft: context.draft,
        currentCore: context.currentCore,
        externalProfile: context.externalProfile,
        actorUserId: params.actorUserId,
        publishJobId: job.id,
        client,
      });
      postNabatableHashes = buildCoreSnapshotHashes(
        await readCoreSnapshots(params.restaurantId, client),
      );
      const { error: jobNabatableError } = await client
        .from('restaurant_external_profile_publish_jobs')
        .update({
          nabatable_publish_event_id: nabatableEventId,
          nabatable_published_at: nowIso(),
          post_nabatable_core_hashes: toJson(postNabatableHashes),
        })
        .eq('id', job.id);
      if (jobNabatableError) {
        throw jobNabatableError;
      }
    } catch (error) {
      const rollback = await restoreCoreSnapshotAfterFailedPublish({
        restaurantId: params.restaurantId,
        draft: context.draft,
        snapshot: context.currentCore,
        client,
      });
      const failedPublishErrors = buildFailedPublishErrors({
        publishError: error,
        rollback,
      });

      await Promise.all([
        client
          .from('restaurant_external_profile_drafts')
          .update({
            status: 'failed',
            conflict_metadata: toJson({
              failedAt: nowIso(),
              rollback,
            }),
          })
          .eq('id', context.draft.id),
        client
          .from('restaurant_external_profile_publish_jobs')
          .update({
            status: 'failed',
            errors: toJson(failedPublishErrors),
            failed_at: nowIso(),
            nabatable_publish_event_id: nabatableEventId,
          })
          .eq('id', job.id),
      ]);
      throw error;
    }
  }

  let googleEventId: string | null = null;
  let finalStatus: 'published' | 'partially_published' = 'published';
  if (context.mode !== 'nabatable_only' && context.googleUpdateMasks.length > 0) {
    const changedGooglePushSections = await loadChangedGooglePushSections({
      restaurantId: params.restaurantId,
      client,
      draft: context.draft,
      expectedHashes: postNabatableHashes,
    });
    if (changedGooglePushSections.length > 0) {
      const error = createCoreChangedPublishError(changedGooglePushSections);
      await Promise.all([
        client
          .from('restaurant_external_profile_drafts')
          .update({
            status: context.mode === 'google_only' ? 'failed' : 'partially_published',
            conflict_metadata: toJson({
              failedAt: nowIso(),
              googlePush: {
                message: error.message,
                classification: null,
                retryable: false,
                reconciliationRequired: context.mode !== 'google_only',
              },
            }),
          })
          .eq('id', context.draft.id),
        client
          .from('restaurant_external_profile_publish_jobs')
          .update({
            status: 'google_failed',
            error_classification: null,
            errors: toJson([
              {
                message: error.message,
                classification: null,
                retryable: false,
                reconciliationRequired: context.mode !== 'google_only',
              },
            ]),
            failed_at: nowIso(),
          })
          .eq('id', job.id),
      ]);
      throw error;
    }

    try {
      googleEventId = await pushDraftToGoogle({
        restaurantId: params.restaurantId,
        draft: context.draft,
        externalProfile: context.externalProfile,
        actorUserId: params.actorUserId,
        googleUpdateMasks: context.googleUpdateMasks,
        currentCore: context.currentCore,
        client,
      });
    } catch (error) {
      finalStatus = 'partially_published';
      googleEventId = extractGoogleEventIdFromPublishError(error, null);
      const classified = classifyWorkflowGooglePushFailure(error);
      const requiresReconciliation =
        classified.reconciliationRequired === true || classified.retryable === false;
      const { error: googleFailureUpdateError } = await client
        .from('restaurant_external_profile_publish_jobs')
        .update({
          status: requiresReconciliation ? 'failed' : 'google_failed',
          google_publish_event_id: googleEventId,
          error_classification:
            classified.classification === undefined ? 'retryable' : classified.classification,
          errors: toJson([classified]),
          failed_at: nowIso(),
        })
        .eq('id', job.id);
      if (googleFailureUpdateError) {
        throw googleFailureUpdateError;
      }
      if (context.mode === 'google_only') {
        const { error: draftGoogleFailureError } = await client
          .from('restaurant_external_profile_drafts')
          .update({
            status: 'failed',
            conflict_metadata: toJson({
              failedAt: nowIso(),
              googlePush: classified,
            }),
          })
          .eq('id', context.draft.id);
        if (draftGoogleFailureError) {
          throw draftGoogleFailureError;
        }
        throw error;
      }
    }
  }

  const publishedAt = nowIso();
  const { error: draftPublishedError } = await client
    .from('restaurant_external_profile_drafts')
    .update({
      status: finalStatus,
      published_by_user_id: params.actorUserId,
      published_at: publishedAt,
    })
    .eq('id', context.draft.id);
  if (draftPublishedError) {
    throw draftPublishedError;
  }

  if (finalStatus === 'published') {
    const { error: jobPublishedError } = await client
      .from('restaurant_external_profile_publish_jobs')
      .update({
        status: 'published',
        google_publish_event_id: googleEventId,
        google_pushed_at: googleEventId ? publishedAt : null,
        error_classification: null,
        errors: [],
      })
      .eq('id', job.id);
    if (jobPublishedError) {
      throw jobPublishedError;
    }
  }

  const response = await readWorkflow(params.restaurantId, client);
  return {
    ...response,
    result: finalStatus,
    nabatableEventId,
    googleEventId,
  };
}
