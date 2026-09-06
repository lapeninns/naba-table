import { DurableObject } from 'cloudflare:workers';

import { isQueueJobPayload } from './contracts';
import { json, readJson, withCorsHeaders } from './gateway-router';
import { processDueJobs as runProcessDueJobs } from './queue-processor';
import {
  DEFAULT_MAX_JOBS,
  dlqKey,
  jobKey,
  normalizeJobHistoryLimit,
  normalizeMaxJobs,
  scheduleKey,
  toJobSummary,
} from './queue-storage';
import { writeStructuredLog } from '../../shared/observability';

import type {
  EmailQueueGatewayEnv,
  JsonObject,
  ProcessDueJobsOptions,
  QueueJob,
  QueueMeta,
} from './contracts';

export class EmailQueueState extends DurableObject<EmailQueueGatewayEnv> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return withCorsHeaders(new Response(null, { status: 204 }));
    }
    if (url.pathname === '/messages' && request.method === 'POST') {
      return withCorsHeaders(await this.handleEnqueue(request));
    }
    if (url.pathname.startsWith('/messages/') && request.method === 'DELETE') {
      return withCorsHeaders(await this.handleDelete(url.pathname.slice('/messages/'.length)));
    }
    if (url.pathname === '/status' && request.method === 'GET') {
      return withCorsHeaders(
        await this.handleStatus(
          url.searchParams.get('includeJobs'),
          url.searchParams.get('jobLimit'),
        ),
      );
    }
    if (url.pathname === '/drain' && request.method === 'POST') {
      return withCorsHeaders(await this.handleDrain(await readJson(request)));
    }
    if (url.pathname === '/health' && request.method === 'GET') {
      return withCorsHeaders(json({ ok: true, timestamp: new Date().toISOString() }));
    }
    return withCorsHeaders(json({ error: 'Not found' }, { status: 404 }));
  }

  async alarm(): Promise<void> {
    await this.processDueJobs({ types: null, maxJobs: DEFAULT_MAX_JOBS });
  }

  async getMeta(): Promise<QueueMeta> {
    return (await this.ctx.storage.get<QueueMeta>('meta')) ?? { completedCount: 0 };
  }

  async putMeta(meta: QueueMeta): Promise<void> {
    await this.ctx.storage.put('meta', meta);
  }

  async handleEnqueue(request: Request): Promise<Response> {
    const body = await readJson(request);
    if (!body) {
      return json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const jobId = typeof body.jobId === 'string' ? body.jobId.trim() : '';
    const payload = body.payload;
    const delayMs =
      typeof body.delayMs === 'number' && Number.isFinite(body.delayMs) && body.delayMs > 0
        ? Math.floor(body.delayMs)
        : 0;
    const attempts =
      typeof body.attempts === 'number' && Number.isFinite(body.attempts) && body.attempts > 0
        ? Math.floor(body.attempts)
        : 5;

    if (!jobId || !isQueueJobPayload(payload)) {
      return json({ error: 'Missing required job payload fields' }, { status: 400 });
    }

    if (await this.ctx.storage.get(jobKey(jobId))) {
      return json({ status: 'duplicate', duplicate: true, jobId }, { status: 409 });
    }
    if (await this.ctx.storage.get(dlqKey(jobId))) {
      return json({ status: 'duplicate', duplicate: true, jobId }, { status: 409 });
    }

    const now = Date.now();
    const scheduledAt = now + delayMs;
    const job: QueueJob = {
      id: jobId,
      queue: typeof body.queue === 'string' ? body.queue : 'pending-booking-emails',
      dlq: typeof body.dlq === 'string' ? body.dlq : 'pending-booking-emails-dlq',
      payload,
      attempts,
      attemptsMade:
        typeof payload.cronAttemptsMade === 'number' && Number.isFinite(payload.cronAttemptsMade)
          ? Math.max(0, Math.floor(payload.cronAttemptsMade))
          : 0,
      backoff: body.backoff ?? { type: 'exponential', delay: 60_000 },
      scheduledAt,
      createdAt: now,
      updatedAt: now,
      status: delayMs > 0 ? 'delayed' : 'waiting',
      lastError: null,
    };

    await this.ctx.storage.put(jobKey(jobId), job);
    await this.ctx.storage.put(scheduleKey(scheduledAt, jobId), jobId);
    await this.scheduleNextAlarm();

    writeStructuredLog({
      level: 'info',
      event: 'product.email_queue.enqueued',
      service: 'email-queue-gateway',
      fields: { queue: job.queue, type: job.payload.type, delayed: delayMs > 0 },
    });

    return json({ status: 'enqueued', duplicate: false, jobId }, { status: 201 });
  }

  async handleDelete(rawId: string): Promise<Response> {
    const jobId = decodeURIComponent(rawId);
    const job = await this.ctx.storage.get<QueueJob>(jobKey(jobId));
    if (!job) {
      return json({ removed: false }, { status: 404 });
    }

    await this.ctx.storage.delete(jobKey(jobId));
    if (typeof job.scheduledAt === 'number') {
      await this.ctx.storage.delete(scheduleKey(job.scheduledAt, jobId));
    }
    await this.scheduleNextAlarm();
    return json({ removed: true });
  }

  async handleStatus(
    includeJobsParam: string | null,
    jobLimitParam: string | null,
  ): Promise<Response> {
    const includeJobs = ['1', 'true', 'yes'].includes(String(includeJobsParam ?? '').toLowerCase());
    const jobHistoryLimit = normalizeJobHistoryLimit(jobLimitParam);
    const meta = await this.getMeta();
    const jobEntries = await this.ctx.storage.list<QueueJob>({ prefix: 'job:' });
    const dlqEntries = await this.ctx.storage.list<QueueJob>({ prefix: 'dlq:' });
    const waiting: QueueJob[] = [];
    const active: QueueJob[] = [];
    const delayed: QueueJob[] = [];

    for (const value of jobEntries.values()) {
      if (value.status === 'active') active.push(value);
      else if (value.status === 'delayed') delayed.push(value);
      else waiting.push(value);
    }

    const dlq = Array.from(dlqEntries.values());
    const sliceJobs = (jobs: QueueJob[]): QueueJob[] =>
      Number.isFinite(jobHistoryLimit) ? jobs.slice(0, jobHistoryLimit) : jobs;

    return json({
      status: 'ok',
      provider: 'cloudflare',
      queue: {
        name: 'pending-booking-emails',
        dlqName: 'pending-booking-emails-dlq',
        counts: {
          waiting: waiting.length,
          active: active.length,
          completed: meta.completedCount ?? 0,
          failed: dlq.length,
          delayed: delayed.length,
          total: waiting.length + active.length + delayed.length,
          dlq: dlq.length,
        },
        jobs: includeJobs
          ? {
              waiting: sliceJobs(waiting).map(toJobSummary),
              active: sliceJobs(active).map(toJobSummary),
              failed: sliceJobs(dlq).map(toJobSummary),
              delayed: sliceJobs(delayed).map(toJobSummary),
              dlq: sliceJobs(dlq).map(toJobSummary),
            }
          : null,
      },
      timestamp: new Date().toISOString(),
    });
  }

  async handleDrain(body: JsonObject | null): Promise<Response> {
    const types =
      body && Array.isArray(body.types)
        ? body.types.filter(
            (value): value is string => typeof value === 'string' && value.length > 0,
          )
        : null;
    return json(await this.processDueJobs({ types, maxJobs: normalizeMaxJobs(body?.maxJobs) }));
  }

  async processDueJobs(options: ProcessDueJobsOptions) {
    return runProcessDueJobs(
      {
        storage: this.ctx.storage,
        appProcessingUrl: this.env.APP_PROCESS_EMAILS_URL,
        appProcessingToken: this.env.APP_PROCESS_EMAILS_TOKEN,
        vercelAutomationBypassSecret: this.env.VERCEL_AUTOMATION_BYPASS_SECRET,
        getMeta: () => this.getMeta(),
        putMeta: (meta) => this.putMeta(meta),
        scheduleNextAlarm: () => this.scheduleNextAlarm(),
      },
      options,
    );
  }

  async scheduleNextAlarm(): Promise<void> {
    const next = await this.ctx.storage.list({ prefix: 'schedule:', limit: 1 });
    const firstKey = next.keys().next();
    if (firstKey.done || typeof firstKey.value !== 'string') {
      await this.ctx.storage.deleteAlarm();
      return;
    }

    const [, timestampPart] = firstKey.value.split(':');
    const scheduledAt = Number(timestampPart);
    if (Number.isFinite(scheduledAt)) {
      await this.ctx.storage.setAlarm(scheduledAt);
    }
  }
}
