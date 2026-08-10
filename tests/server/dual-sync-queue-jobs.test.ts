import { describe, expect, it, vi } from 'vitest';

import {
  claimNextDualSyncJob,
  completeDualSyncJob,
  enqueueDualSyncJob,
  failDualSyncJob,
  listRecentDualSyncJobs,
  retryDualSyncJob,
} from '@/server/dual-sync/queue/jobs';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

interface MockChain {
  readonly insert: ReturnType<typeof vi.fn>;
  readonly upsert: ReturnType<typeof vi.fn>;
  readonly update: ReturnType<typeof vi.fn>;
  readonly select: ReturnType<typeof vi.fn>;
  readonly eq: ReturnType<typeof vi.fn>;
  readonly neq: ReturnType<typeof vi.fn>;
  readonly in: ReturnType<typeof vi.fn>;
  readonly is: ReturnType<typeof vi.fn>;
  readonly lte: ReturnType<typeof vi.fn>;
  readonly order: ReturnType<typeof vi.fn>;
  readonly limit: ReturnType<typeof vi.fn>;
  readonly single: ReturnType<typeof vi.fn>;
  readonly maybeSingle: ReturnType<typeof vi.fn>;
  readonly then: (resolve: (value: { data: unknown; error: null }) => unknown) => unknown;
}

function makeChain(result: unknown): MockChain {
  const chain: Partial<MockChain> = {};
  const fluent = vi.fn(() => chain as MockChain);
  Object.assign(chain, {
    insert: fluent,
    upsert: fluent,
    update: fluent,
    select: fluent,
    eq: fluent,
    neq: fluent,
    in: fluent,
    is: fluent,
    lte: fluent,
    order: fluent,
    limit: fluent,
    single: vi.fn(async () => ({ data: result, error: null })),
    maybeSingle: vi.fn(async () => ({ data: result, error: null })),
    then: (resolve: (value: { data: unknown; error: null }) => unknown) =>
      Promise.resolve(resolve({ data: result, error: null })),
  });
  return chain as MockChain;
}

function clientFor(chain: MockChain) {
  return { from: vi.fn(() => chain) } as unknown as SupabaseClient<Database>;
}

function makeJobRow(over: Record<string, unknown> = {}) {
  return {
    id: 'job-1',
    restaurant_id: 'rest-1',
    provider: 'google_business_profile',
    job_kind: 'publish_batch',
    status: 'queued',
    idempotency_key: 'request-1',
    priority: 100,
    payload: { publishBatchId: 'batch-1' },
    attempt_count: 0,
    max_attempts: 3,
    available_at: '2026-05-09T00:00:00.000Z',
    locked_at: null,
    locked_by: null,
    last_error_code: null,
    last_error_message: null,
    dead_letter_reason: null,
    started_at: null,
    finished_at: null,
    created_at: '2026-05-09T00:00:00.000Z',
    updated_at: '2026-05-09T00:00:00.000Z',
    ...over,
  };
}

describe('dual-sync queue job helpers', () => {
  it('enqueues an idempotent job with payload and priority', async () => {
    const chain = makeChain(makeJobRow());
    const client = clientFor(chain);

    const job = await enqueueDualSyncJob({
      client,
      restaurantId: 'rest-1',
      jobKind: 'publish_batch',
      idempotencyKey: 'request-1',
      payload: { publishBatchId: 'batch-1' },
      priority: 10,
    });

    expect(client.from).toHaveBeenCalledWith('dual_sync_jobs');
    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurant_id: 'rest-1',
        job_kind: 'publish_batch',
        idempotency_key: 'request-1',
        priority: 10,
        max_attempts: 1,
      }),
      expect.objectContaining({
        onConflict: 'restaurant_id,provider,job_kind,idempotency_key',
        ignoreDuplicates: true,
      }),
    );
    expect(job.id).toBe('job-1');
  });

  it('returns the existing job when idempotent enqueue is already present', async () => {
    const upsertChain = makeChain(null);
    const readChain = makeChain(makeJobRow({ id: 'job-existing' }));
    const fromMock = vi.fn().mockReturnValueOnce(upsertChain).mockReturnValueOnce(readChain);
    const client = { from: fromMock } as unknown as SupabaseClient<Database>;

    const job = await enqueueDualSyncJob({
      client,
      restaurantId: 'rest-1',
      jobKind: 'publish_batch',
      idempotencyKey: 'request-1',
      payload: { publishBatchId: 'batch-1' },
    });

    expect(upsertChain.upsert).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ ignoreDuplicates: true }),
    );
    expect(readChain.eq).toHaveBeenCalledWith('restaurant_id', 'rest-1');
    expect(readChain.eq).toHaveBeenCalledWith('provider', 'google_business_profile');
    expect(readChain.eq).toHaveBeenCalledWith('job_kind', 'publish_batch');
    expect(readChain.eq).toHaveBeenCalledWith('idempotency_key', 'request-1');
    expect(job.id).toBe('job-existing');
  });

  it('rejects idempotent enqueue when the existing payload differs', async () => {
    const upsertChain = makeChain(null);
    const readChain = makeChain(makeJobRow({ id: 'job-existing' }));
    const fromMock = vi.fn().mockReturnValueOnce(upsertChain).mockReturnValueOnce(readChain);
    const client = { from: fromMock } as unknown as SupabaseClient<Database>;

    await expect(
      enqueueDualSyncJob({
        client,
        restaurantId: 'rest-1',
        jobKind: 'publish_batch',
        idempotencyKey: 'request-1',
        payload: { publishBatchId: 'different-batch' },
      }),
    ).rejects.toThrow('idempotency key was already used with a different payload');
  });

  it('rejects content-bearing GBP job payloads before persistence', async () => {
    const chain = makeChain(null);
    const client = clientFor(chain);

    await expect(
      enqueueDualSyncJob({
        client,
        restaurantId: 'rest-1',
        jobKind: 'publish_batch',
        payload: {
          publishBatchId: 'batch-1',
          providerResponse: { name: 'Private Google content' },
        },
      }),
    ).rejects.toThrow();
    expect(client.from).not.toHaveBeenCalled();
  });

  it('claims the next available queued job for a worker', async () => {
    const staleChain = makeChain([]);
    const readChain = makeChain([makeJobRow()]);
    const updateChain = makeChain(makeJobRow({ status: 'running', attempt_count: 1 }));
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(staleChain)
      .mockReturnValueOnce(readChain)
      .mockReturnValueOnce(updateChain);
    const client = { from: fromMock } as unknown as SupabaseClient<Database>;

    const job = await claimNextDualSyncJob({
      client,
      workerId: 'worker-1',
      now: '2026-05-09T00:01:00.000Z',
    });

    expect(staleChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'retrying',
        available_at: '2026-05-09T00:01:00.000Z',
        locked_at: null,
        locked_by: null,
        last_error_code: 'DUAL_SYNC_JOB_STALE_CLAIM',
      }),
    );
    expect(staleChain.eq).toHaveBeenCalledWith('status', 'running');
    expect(staleChain.is).toHaveBeenCalledWith('write_bundle_id', null);
    expect(staleChain.lte).toHaveBeenCalledWith('locked_at', '2026-05-08T23:46:00.000Z');
    expect(readChain.in).toHaveBeenCalledWith('status', ['queued', 'retrying']);
    expect(readChain.lte).toHaveBeenCalledWith('available_at', '2026-05-09T00:01:00.000Z');
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'running',
        attempt_count: 1,
        locked_by: 'worker-1',
      }),
    );
    expect(job?.status).toBe('running');
  });

  it('reclaims stale running jobs before claiming work', async () => {
    const staleChain = makeChain([]);
    const readChain = makeChain([makeJobRow({ id: 'stale-job', status: 'retrying' })]);
    const updateChain = makeChain(makeJobRow({ id: 'stale-job', status: 'running' }));
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(staleChain)
      .mockReturnValueOnce(readChain)
      .mockReturnValueOnce(updateChain);
    const client = { from: fromMock } as unknown as SupabaseClient<Database>;

    const job = await claimNextDualSyncJob({
      client,
      workerId: 'worker-2',
      now: '2026-05-09T00:20:00.000Z',
      staleRunningAfterMs: 5 * 60 * 1000,
    });

    expect(staleChain.lte).toHaveBeenCalledWith('locked_at', '2026-05-09T00:15:00.000Z');
    expect(updateChain.eq).toHaveBeenCalledWith('id', 'stale-job');
    expect(job?.id).toBe('stale-job');
  });

  it('returns null when no job is claimable', async () => {
    const chain = makeChain([]);
    const client = clientFor(chain);

    await expect(claimNextDualSyncJob({ client, workerId: 'worker-1' })).resolves.toBeNull();
  });

  it('marks jobs succeeded, retrying, and dead-letter', async () => {
    const completeChain = makeChain(makeJobRow({ status: 'succeeded' }));
    await completeDualSyncJob({
      client: clientFor(completeChain),
      jobId: 'job-1',
      finishedAt: '2026-05-09T00:02:00.000Z',
    });
    expect(completeChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'succeeded',
        finished_at: '2026-05-09T00:02:00.000Z',
      }),
    );

    const retryChain = makeChain(makeJobRow({ status: 'retrying', attempt_count: 1 }));
    await failDualSyncJob({
      client: clientFor(retryChain),
      jobId: 'job-1',
      attemptCount: 1,
      maxAttempts: 3,
      errorCode: 'QUOTA_LIMITED',
      errorMessage: 'Retry later',
      retryAfterMs: 60_000,
      now: '2026-05-09T00:03:00.000Z',
    });
    expect(retryChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'retrying',
        last_error_code: 'QUOTA_LIMITED',
        available_at: '2026-05-09T00:04:00.000Z',
      }),
    );

    const deadChain = makeChain(makeJobRow({ status: 'dead_letter', attempt_count: 3 }));
    await failDualSyncJob({
      client: clientFor(deadChain),
      jobId: 'job-1',
      attemptCount: 3,
      maxAttempts: 3,
      errorCode: 'EXTERNAL_API_ERROR',
      errorMessage: 'Provider still failing',
      now: '2026-05-09T00:05:00.000Z',
    });
    expect(deadChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'dead_letter',
        last_error_code: 'EXTERNAL_API_ERROR',
        last_error_message: null,
        dead_letter_reason: 'EXTERNAL_API_ERROR',
        finished_at: '2026-05-09T00:05:00.000Z',
      }),
    );
  });

  it('lists recent jobs by restaurant with optional status filters', async () => {
    const chain = makeChain([makeJobRow(), makeJobRow({ id: 'job-2', status: 'retrying' })]);
    const client = clientFor(chain);

    const jobs = await listRecentDualSyncJobs({
      client,
      restaurantId: 'rest-1',
      statuses: ['queued', 'retrying'],
      limit: 500,
    });

    expect(chain.eq).toHaveBeenCalledWith('restaurant_id', 'rest-1');
    expect(chain.in).toHaveBeenCalledWith('status', ['queued', 'retrying']);
    expect(chain.limit).toHaveBeenCalledWith(200);
    expect(jobs).toHaveLength(2);
  });

  it('requeues a terminal job for operator retry', async () => {
    const chain = makeChain(
      makeJobRow({
        status: 'queued',
        attempt_count: 0,
        locked_at: null,
        locked_by: null,
        last_error_code: null,
        last_error_message: null,
        dead_letter_reason: null,
        finished_at: null,
      }),
    );
    const client = clientFor(chain);

    const job = await retryDualSyncJob({
      client,
      restaurantId: 'rest-1',
      jobId: 'job-1',
      availableAt: '2026-05-09T00:06:00.000Z',
    });

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'queued',
        attempt_count: 0,
        started_at: null,
        available_at: '2026-05-09T00:06:00.000Z',
        last_error_code: null,
        dead_letter_reason: null,
      }),
    );
    expect(chain.is).toHaveBeenCalledWith('write_bundle_id', null);
    expect(chain.eq).toHaveBeenCalledWith('id', 'job-1');
    expect(chain.eq).toHaveBeenCalledWith('restaurant_id', 'rest-1');
    expect(chain.in).toHaveBeenCalledWith('status', ['failed', 'dead_letter', 'cancelled']);
    expect(job?.status).toBe('queued');
  });
});
