import { DurableObject } from 'cloudflare:workers';
import { json, readJson, routeGatewayRequest, withCorsHeaders } from './gateway-router.mjs';

const DEFAULT_MAX_JOBS = 25;
const MAX_SCAN = 200;
const JOB_HISTORY_LIMIT = 10;
const JOB_HISTORY_LIMIT_ALL = 'all';

function scheduleKey(scheduledAt, jobId) {
  return `schedule:${String(scheduledAt).padStart(15, '0')}:${jobId}`;
}

function jobKey(jobId) {
  return `job:${jobId}`;
}

function dlqKey(jobId) {
  return `dlq:${jobId}`;
}

function parseBackoffDelay(backoff, attempt) {
  if (!backoff || typeof backoff !== 'object') {
    return 60_000;
  }

  const type = typeof backoff.type === 'string' ? backoff.type : 'exponential';
  const baseDelay =
    typeof backoff.delay === 'number' && Number.isFinite(backoff.delay) && backoff.delay > 0
      ? Math.floor(backoff.delay)
      : 60_000;

  if (type === 'fixed') {
    return baseDelay;
  }

  return Math.min(30 * 60_000, baseDelay * Math.pow(2, Math.max(0, attempt - 1)));
}

function normalizeMaxJobs(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_MAX_JOBS;
  }
  return Math.max(1, Math.min(100, Math.floor(value)));
}

function normalizeJobHistoryLimit(value) {
  if (typeof value === 'string' && value.trim().toLowerCase() === JOB_HISTORY_LIMIT_ALL) {
    return Number.POSITIVE_INFINITY;
  }

  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : Number.NaN;
  if (!Number.isFinite(parsed)) {
    return JOB_HISTORY_LIMIT;
  }

  return Math.max(1, Math.min(5_000, Math.floor(parsed)));
}

function toJobSummary(job) {
  return {
    id: job.id,
    payload: job.payload,
    scheduledFor: typeof job.payload?.scheduledFor === 'string' ? job.payload.scheduledFor : null,
    status: job.status ?? null,
  };
}

export class EmailQueueState extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
  }

  async fetch(request) {
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
      const body = await readJson(request);
      return withCorsHeaders(await this.handleDrain(body));
    }

    if (url.pathname === '/health' && request.method === 'GET') {
      return withCorsHeaders(json({ ok: true, timestamp: new Date().toISOString() }));
    }

    return withCorsHeaders(json({ error: 'Not found' }, { status: 404 }));
  }

  async alarm() {
    await this.processDueJobs({ types: null, maxJobs: DEFAULT_MAX_JOBS });
  }

  async getMeta() {
    return (await this.ctx.storage.get('meta')) ?? { completedCount: 0 };
  }

  async putMeta(meta) {
    await this.ctx.storage.put('meta', meta);
  }

  async handleEnqueue(request) {
    const body = await readJson(request);
    if (!body || typeof body !== 'object') {
      return json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const jobId = typeof body.jobId === 'string' ? body.jobId.trim() : '';
    const payload = typeof body.payload === 'object' && body.payload ? body.payload : null;
    const delayMs =
      typeof body.delayMs === 'number' && Number.isFinite(body.delayMs) && body.delayMs > 0
        ? Math.floor(body.delayMs)
        : 0;
    const attempts =
      typeof body.attempts === 'number' && Number.isFinite(body.attempts) && body.attempts > 0
        ? Math.floor(body.attempts)
        : 5;

    if (
      !jobId ||
      !payload ||
      typeof payload.bookingId !== 'string' ||
      typeof payload.type !== 'string'
    ) {
      return json({ error: 'Missing required job payload fields' }, { status: 400 });
    }

    const existing = await this.ctx.storage.get(jobKey(jobId));
    if (existing) {
      return json({ status: 'duplicate', duplicate: true, jobId }, { status: 409 });
    }

    const existingDlq = await this.ctx.storage.get(dlqKey(jobId));
    if (existingDlq) {
      return json({ status: 'duplicate', duplicate: true, jobId }, { status: 409 });
    }

    const now = Date.now();
    const scheduledAt = now + delayMs;
    const job = {
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

    return json({ status: 'enqueued', duplicate: false, jobId }, { status: 201 });
  }

  async handleDelete(rawId) {
    const jobId = decodeURIComponent(rawId);
    const job = await this.ctx.storage.get(jobKey(jobId));
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

  async handleStatus(includeJobsParam, jobLimitParam) {
    const includeJobs = ['1', 'true', 'yes'].includes(String(includeJobsParam ?? '').toLowerCase());
    const jobHistoryLimit = normalizeJobHistoryLimit(jobLimitParam);
    const meta = await this.getMeta();
    const jobEntries = await this.ctx.storage.list({ prefix: 'job:' });
    const dlqEntries = await this.ctx.storage.list({ prefix: 'dlq:' });

    const waiting = [];
    const active = [];
    const delayed = [];

    for (const [, value] of jobEntries) {
      if (!value || typeof value !== 'object') continue;
      if (value.status === 'active') active.push(value);
      else if (value.status === 'delayed') delayed.push(value);
      else waiting.push(value);
    }

    const dlq = Array.from(dlqEntries.values()).filter(Boolean);
    const counts = {
      waiting: waiting.length,
      active: active.length,
      completed: meta.completedCount ?? 0,
      failed: dlq.length,
      delayed: delayed.length,
      total: waiting.length + active.length + delayed.length,
      dlq: dlq.length,
    };

    const sliceJobs = (jobs) =>
      Number.isFinite(jobHistoryLimit) ? jobs.slice(0, jobHistoryLimit) : jobs;

    return json({
      status: 'ok',
      provider: 'cloudflare',
      queue: {
        name: 'pending-booking-emails',
        dlqName: 'pending-booking-emails-dlq',
        counts,
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

  async handleDrain(body) {
    const types =
      body && Array.isArray(body.types)
        ? body.types.filter((value) => typeof value === 'string' && value.length > 0)
        : null;
    const maxJobs = normalizeMaxJobs(body?.maxJobs);
    const result = await this.processDueJobs({ types, maxJobs });
    return json(result);
  }

  async processDueJobs({ types, maxJobs }) {
    const now = Date.now();
    const selected = [];
    const scheduleEntries = await this.ctx.storage.list({ prefix: 'schedule:', limit: MAX_SCAN });

    for (const [key, storedJobId] of scheduleEntries) {
      if (selected.length >= maxJobs) break;

      const [, timestampPart, jobIdFromKey] = key.split(':');
      const scheduledAt = Number(timestampPart);
      const jobId = typeof storedJobId === 'string' ? storedJobId : jobIdFromKey;

      if (!Number.isFinite(scheduledAt)) continue;
      if (scheduledAt > now) break;

      const job = await this.ctx.storage.get(jobKey(jobId));
      if (!job) {
        await this.ctx.storage.delete(key);
        continue;
      }

      if (types && Array.isArray(types) && !types.includes(job.payload?.type)) {
        continue;
      }

      selected.push(job);
      job.status = 'active';
      job.updatedAt = now;
      await this.ctx.storage.put(jobKey(jobId), job);
      await this.ctx.storage.delete(key);
    }

    if (selected.length === 0) {
      await this.scheduleNextAlarm();
      return {
        success: true,
        message: 'No pending emails to process',
        processed: 0,
        stats: { sent: 0, skipped: 0, failed: 0 },
        results: [],
        filterTypes: types,
      };
    }

    let batchResult;
    try {
      const response = await fetch(this.env.APP_PROCESS_EMAILS_URL, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.env.APP_PROCESS_EMAILS_TOKEN}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          jobs: selected.map((job) => ({
            id: job.id,
            payload: job.payload,
          })),
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload || payload.success !== true) {
        throw new Error(payload?.error || `App processing failed with status ${response.status}`);
      }
      batchResult = payload;
    } catch (error) {
      batchResult = {
        success: false,
        processed: selected.length,
        stats: { sent: 0, skipped: 0, failed: selected.length },
        results: selected.map((job) => ({
          jobId: job.id,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        })),
      };
    }

    const meta = await this.getMeta();
    const resultsById = new Map(
      Array.isArray(batchResult.results)
        ? batchResult.results.map((result) => [result.jobId, result])
        : [],
    );

    for (const job of selected) {
      const result = resultsById.get(job.id) ?? {
        jobId: job.id,
        success: false,
        error: 'Missing processing result',
      };

      if (result.success) {
        await this.ctx.storage.delete(jobKey(job.id));
        meta.completedCount = (meta.completedCount ?? 0) + 1;
        continue;
      }

      const nextAttempt = (job.attemptsMade ?? 0) + 1;
      const errorMessage =
        typeof result.error === 'string' && result.error.length > 0
          ? result.error
          : 'Unknown processing error';

      if (nextAttempt >= job.attempts) {
        const failedRecord = {
          ...job,
          status: 'failed',
          attemptsMade: nextAttempt,
          failedAt: new Date().toISOString(),
          lastError: errorMessage,
        };
        await this.ctx.storage.delete(jobKey(job.id));
        await this.ctx.storage.put(dlqKey(job.id), failedRecord);
        continue;
      }

      const retryDelayMs = parseBackoffDelay(job.backoff, nextAttempt);
      const retryScheduledAt = Date.now() + retryDelayMs;
      const retriedJob = {
        ...job,
        attemptsMade: nextAttempt,
        updatedAt: Date.now(),
        scheduledAt: retryScheduledAt,
        status: retryDelayMs > 0 ? 'delayed' : 'waiting',
        lastError: errorMessage,
        payload: {
          ...job.payload,
          cronAttemptsMade: nextAttempt,
          failedReason: errorMessage,
          failedAt: new Date().toISOString(),
        },
      };

      await this.ctx.storage.put(jobKey(job.id), retriedJob);
      await this.ctx.storage.put(scheduleKey(retryScheduledAt, job.id), job.id);
    }

    await this.putMeta(meta);
    await this.scheduleNextAlarm();

    return {
      success: true,
      message: `Processed ${selected.length} jobs`,
      processed: selected.length,
      stats: batchResult.stats ?? {
        sent: 0,
        skipped: 0,
        failed: selected.length,
      },
      results: batchResult.results ?? [],
      filterTypes: types,
    };
  }

  async scheduleNextAlarm() {
    const next = await this.ctx.storage.list({ prefix: 'schedule:', limit: 1 });
    const firstKey = next.keys().next();

    if (firstKey.done || typeof firstKey.value !== 'string') {
      await this.ctx.storage.deleteAlarm();
      return;
    }

    const [, timestampPart] = firstKey.value.split(':');
    const scheduledAt = Number(timestampPart);
    if (!Number.isFinite(scheduledAt)) {
      return;
    }

    await this.ctx.storage.setAlarm(scheduledAt);
  }
}

export class RateLimitState extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname !== '/rate-limit/consume' || request.method !== 'POST') {
      return withCorsHeaders(json({ error: 'Not found' }, { status: 404 }));
    }

    const body = await readJson(request);
    if (
      !body ||
      typeof body.identifier !== 'string' ||
      typeof body.limit !== 'number' ||
      typeof body.windowMs !== 'number'
    ) {
      return withCorsHeaders(json({ error: 'Invalid rate limit payload' }, { status: 400 }));
    }

    const now = Date.now();
    const windowMs = Math.max(1, Math.floor(body.windowMs));
    const limit = Math.max(1, Math.floor(body.limit));
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const resetAt = windowStart + windowMs;
    const current = await this.ctx.storage.get('bucket');

    let count = 1;
    if (
      current &&
      typeof current === 'object' &&
      current.windowStart === windowStart &&
      typeof current.count === 'number'
    ) {
      count = Math.max(0, Math.floor(current.count)) + 1;
    }

    await this.ctx.storage.put('bucket', {
      windowStart,
      count,
      resetAt,
    });

    return withCorsHeaders(
      json({
        ok: count <= limit,
        limit,
        remaining: Math.max(0, limit - count),
        resetAt,
        source: 'cloudflare',
      }),
    );
  }
}

export class CapacityVersionState extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/capacity/versions/bump' && request.method === 'POST') {
      return withCorsHeaders(await this.handleBump(request));
    }

    if (url.pathname === '/capacity/versions/read' && request.method === 'POST') {
      return withCorsHeaders(await this.handleRead(request));
    }

    return withCorsHeaders(json({ error: 'Not found' }, { status: 404 }));
  }

  async handleBump(request) {
    const body = await readJson(request);
    const restaurantId = typeof body?.restaurantId === 'string' ? body.restaurantId.trim() : '';
    const kind = body?.kind === 'adj' ? 'adj' : body?.kind === 'inv' ? 'inv' : null;

    if (!restaurantId || !kind) {
      return json({ error: 'Invalid capacity version bump payload' }, { status: 400 });
    }

    const key = `${kind}:${restaurantId}`;
    const current = await this.ctx.storage.get(key);
    const nextVersion =
      typeof current === 'number' && Number.isFinite(current) ? Math.floor(current) + 1 : 1;

    await this.ctx.storage.put(key, nextVersion);

    return json({
      ok: true,
      restaurantId,
      kind,
      version: nextVersion,
    });
  }

  async handleRead(request) {
    const body = await readJson(request);
    const restaurantIds = Array.isArray(body?.restaurantIds)
      ? body.restaurantIds.filter((value) => typeof value === 'string' && value.trim().length > 0)
      : [];

    const versions = {};
    for (const restaurantId of restaurantIds) {
      const inv = await this.ctx.storage.get(`inv:${restaurantId}`);
      const adj = await this.ctx.storage.get(`adj:${restaurantId}`);
      versions[restaurantId] = {
        inv: typeof inv === 'number' && Number.isFinite(inv) ? Math.floor(inv) : 0,
        adj: typeof adj === 'number' && Number.isFinite(adj) ? Math.floor(adj) : 0,
      };
    }

    return json({
      ok: true,
      versions,
    });
  }
}

export default {
  async fetch(request, env) {
    return routeGatewayRequest(request, env);
  },
};
