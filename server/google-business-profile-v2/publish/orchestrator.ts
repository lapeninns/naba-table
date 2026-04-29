/**
 * Phase 3 of the GBP Dual-Sync V2 architecture.
 *
 * Publish orchestrator. Drives a single publish job through the right
 * pipeline (`import_to_nabatable` or `export_to_google`), records audit
 * events at every step, and routes failures to the rollback coordinator.
 *
 * Idempotency is provided by the unique index on
 * `gbp_sync_v2_publish_jobs.idempotency_key` plus this orchestrator's
 * status guard: a job that is not in `preflight_locked` is a no-op (returns
 * the existing terminal state).
 */

import { writePublishEvent } from './audit';
import { setDraftStatus } from '../drafts/store';
import { getPublishJob, setPublishJobStatus } from '../preflight/store';

import type { OrchestratorPorts } from './ports';
import type { SyncV2PreflightNotice, SyncV2PublishJob, SyncV2SectionKey } from '../types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface ExecutePublishInput {
  readonly client: SupabaseClient<Database>;
  readonly jobId: string;
  readonly actorUserId: string | null;
  readonly ports: OrchestratorPorts;
}

export interface ExecutePublishOutput {
  readonly publishJob: SyncV2PublishJob;
  readonly nabatableEventId: string | null;
  readonly googleEventId: string | null;
  readonly rollbackEventId: string | null;
  readonly errors: ReadonlyArray<SyncV2PreflightNotice>;
}

export async function executePublish({
  client,
  jobId,
  actorUserId,
  ports,
}: ExecutePublishInput): Promise<ExecutePublishOutput> {
  const job = await getPublishJob({ client, jobId });
  if (!job) {
    throw new Error(`V2 publish job not found: ${jobId}`);
  }
  if (!ports.directionIntentSupported(job.directionIntent)) {
    throw new Error(`V2 direction intent unsupported by orchestrator: ${job.directionIntent}`);
  }

  // Idempotency guard: a job already published or terminally failed is not
  // re-run. Return the persisted terminal state.
  if (job.status !== 'preflight_locked') {
    return {
      publishJob: job,
      nabatableEventId: job.nabatableEventId,
      googleEventId: job.googleEventId,
      rollbackEventId: job.rollbackEventId,
      errors: job.errors,
    };
  }

  const lockErrors = await ports.verifyContractLock(job);
  if (lockErrors.length > 0) {
    await setPublishJobStatus({
      client,
      jobId,
      status: 'failed',
      patch: {
        error_classification: 'contract_lock_mismatch',
        errors: lockErrors as never,
        failed_at: new Date().toISOString(),
      },
    });
    await setDraftStatus({ client, draftId: job.draftId, status: 'failed' });
    return {
      publishJob: {
        ...job,
        status: 'failed',
        errorClassification: 'contract_lock_mismatch',
        errors: lockErrors,
      },
      nabatableEventId: null,
      googleEventId: null,
      rollbackEventId: null,
      errors: lockErrors,
    };
  }

  await setPublishJobStatus({ client, jobId, status: 'publishing' });

  if (job.directionIntent === 'import_to_nabatable') {
    return runImportPipeline({ client, job, actorUserId, ports });
  }
  return runExportPipeline({ client, job, actorUserId, ports });
}

interface PipelineInput {
  readonly client: SupabaseClient<Database>;
  readonly job: SyncV2PublishJob;
  readonly actorUserId: string | null;
  readonly ports: OrchestratorPorts;
}

async function runImportPipeline({
  client,
  job,
  actorUserId,
  ports,
}: PipelineInput): Promise<ExecutePublishOutput> {
  const result = await ports.applyToNabatable({ publishJob: job, actorUserId });
  if (!result.ok) {
    const eventId = await writePublishEvent({
      client,
      publishJobId: job.id,
      restaurantId: job.restaurantId,
      direction: job.directionIntent,
      leg: 'nabatable_apply',
      result: 'failed',
      errors: result.failure.errors,
      actorUserId,
    });
    await setPublishJobStatus({
      client,
      jobId: job.id,
      status: 'failed',
      patch: {
        nabatable_event_id: eventId,
        error_classification: result.failure.classification,
        errors: result.failure.errors as never,
        failed_at: new Date().toISOString(),
      },
    });
    await setDraftStatus({ client, draftId: job.draftId, status: 'failed' });
    return {
      publishJob: {
        ...job,
        status: 'failed',
        errorClassification: result.failure.classification,
        errors: result.failure.errors,
        nabatableEventId: eventId,
      },
      nabatableEventId: eventId,
      googleEventId: null,
      rollbackEventId: null,
      errors: result.failure.errors,
    };
  }
  const eventId = await writePublishEvent({
    client,
    publishJobId: job.id,
    restaurantId: job.restaurantId,
    direction: job.directionIntent,
    leg: 'nabatable_apply',
    result: 'success',
    affectedSectionKeys: result.output.affectedSectionKeys,
    oldValues: result.output.oldValues,
    newValues: result.output.newValues,
    actorUserId,
  });
  await setPublishJobStatus({
    client,
    jobId: job.id,
    status: 'published',
    patch: {
      nabatable_event_id: eventId,
      published_at: new Date().toISOString(),
      published_by_user_id: actorUserId,
    },
  });
  await setDraftStatus({ client, draftId: job.draftId, status: 'published' });
  return {
    publishJob: { ...job, status: 'published', nabatableEventId: eventId },
    nabatableEventId: eventId,
    googleEventId: null,
    rollbackEventId: null,
    errors: [],
  };
}

async function runExportPipeline({
  client,
  job,
  actorUserId,
  ports,
}: PipelineInput): Promise<ExecutePublishOutput> {
  const result = await ports.patchGoogle({
    publishJob: job,
    googleUpdateMasks: job.googleUpdateMasks,
    actorUserId,
  });
  if (!result.ok) {
    const eventId = await writePublishEvent({
      client,
      publishJobId: job.id,
      restaurantId: job.restaurantId,
      direction: job.directionIntent,
      leg: 'google_patch',
      result: 'failed',
      googleUpdateMasks: job.googleUpdateMasks,
      errors: result.failure.errors,
      actorUserId,
    });
    await setPublishJobStatus({
      client,
      jobId: job.id,
      status: 'failed',
      patch: {
        google_event_id: eventId,
        error_classification: result.failure.classification,
        errors: result.failure.errors as never,
        failed_at: new Date().toISOString(),
      },
    });
    await setDraftStatus({ client, draftId: job.draftId, status: 'failed' });
    // Export failure with no Google write side-effect: nothing to roll back.
    // If the writer reports `partial` semantics in future, switch to
    // recordRollback instead.
    return {
      publishJob: {
        ...job,
        status: 'failed',
        errorClassification: result.failure.classification,
        errors: result.failure.errors,
        googleEventId: eventId,
      },
      nabatableEventId: null,
      googleEventId: eventId,
      rollbackEventId: null,
      errors: result.failure.errors,
    };
  }
  const eventId = await writePublishEvent({
    client,
    publishJobId: job.id,
    restaurantId: job.restaurantId,
    direction: job.directionIntent,
    leg: 'google_patch',
    result: 'success',
    affectedSectionKeys: result.output.affectedSectionKeys,
    googleUpdateMasks: result.output.googleUpdateMasks,
    oldValues: result.output.oldValues,
    newValues: result.output.newValues,
    actorUserId,
  });
  await setPublishJobStatus({
    client,
    jobId: job.id,
    status: 'published',
    patch: {
      google_event_id: eventId,
      published_at: new Date().toISOString(),
      published_by_user_id: actorUserId,
    },
  });
  await setDraftStatus({ client, draftId: job.draftId, status: 'published' });
  return {
    publishJob: { ...job, status: 'published', googleEventId: eventId },
    nabatableEventId: null,
    googleEventId: eventId,
    rollbackEventId: null,
    errors: [],
  };
}

/**
 * Helper for writers that need to produce a `WriterFailure` with a single
 * error code and message.
 */
export function writerFailure(
  classification: 'retryable' | 'permission' | 'validation' | 'unsupported_field' | 'quota',
  code: string,
  message: string,
  affectedSectionKeys?: ReadonlyArray<SyncV2SectionKey>,
): {
  readonly ok: false;
  readonly failure: {
    readonly classification: typeof classification;
    readonly errors: ReadonlyArray<SyncV2PreflightNotice>;
  };
} {
  const errors: ReadonlyArray<SyncV2PreflightNotice> = [
    {
      code,
      message,
      ...(affectedSectionKeys && affectedSectionKeys.length > 0
        ? { sectionKey: affectedSectionKeys[0] }
        : {}),
    },
  ];
  return { ok: false, failure: { classification, errors } };
}

export type { ExecutePublishInput as PublishOrchestratorInput };
