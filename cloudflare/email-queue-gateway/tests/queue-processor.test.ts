import { afterEach, describe, expect, it, vi } from 'vitest';

import { processDueJobs, type QueueProcessorContext } from '../src/queue-processor';

import type { QueueJob } from '../src/contracts';

function context(bypass?: string): QueueProcessorContext {
  const job: QueueJob = {
    id: 'synthetic-job',
    queue: 'email',
    dlq: 'email-dlq',
    payload: { bookingId: 'synthetic-booking', type: 'confirmation' },
    attempts: 3,
    attemptsMade: 0,
    backoff: 1000,
    scheduledAt: 1,
    createdAt: 1,
    updatedAt: 1,
    status: 'waiting',
    lastError: null,
  };
  const records = new Map<string, unknown>([['job:synthetic-job', job]]);
  return {
    storage: {
      list: async <Value>() => new Map([['schedule:1:synthetic-job', 'synthetic-job' as Value]]),
      get: async <Value>(key: string) => records.get(key) as Value | undefined,
      put: async (key, value) => {
        records.set(key, value);
      },
      delete: async (key) => records.delete(key),
    },
    appProcessingUrl: 'https://nabatable-staging-ops.vercel.app/api/cron/process-emails',
    appProcessingToken: 'test-processing-token',
    ...(bypass === undefined ? {} : { vercelAutomationBypassSecret: bypass }),
    getMeta: async () => ({ completedCount: 0 }),
    putMeta: async () => {},
    scheduleNextAlarm: async () => {},
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('protected app email processing', () => {
  it('sends the optional bypass and processing bearer only to the configured URL', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        success: true,
        processed: 1,
        stats: { sent: 1, skipped: 0, failed: 0 },
        results: [{ jobId: 'synthetic-job', success: true }],
      }),
    );
    vi.stubGlobal('fetch', fetcher);
    const input = context('test-vercel-bypass');
    await processDueJobs(input, { types: null, maxJobs: 1 });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledWith(
      input.appProcessingUrl,
      expect.objectContaining({
        redirect: 'manual',
        headers: expect.objectContaining({
          authorization: 'Bearer test-processing-token',
          'x-vercel-protection-bypass': 'test-vercel-bypass',
        }),
      }),
    );
  });

  it.each([undefined, '', '   '])(
    'omits the bypass header when unconfigured (%s)',
    async (secret) => {
      const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));
      vi.stubGlobal('fetch', fetcher);
      await processDueJobs(context(secret), { types: null, maxJobs: 1 });
      expect(fetcher.mock.calls[0]?.[1].headers).not.toHaveProperty('x-vercel-protection-bypass');
    },
  );

  it('does not follow a redirect or mark its selected job completed', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 307,
        headers: { location: 'https://untrusted.example/collect' },
      }),
    );
    vi.stubGlobal('fetch', fetcher);
    const input = context('test-vercel-bypass');
    const result = await processDueJobs(input, { types: null, maxJobs: 1 });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0]?.[1].redirect).toBe('manual');
    expect(result.stats).toEqual({ sent: 0, skipped: 0, failed: 1 });
    expect(await input.storage.get<QueueJob>('job:synthetic-job')).toMatchObject({
      attemptsMade: 1,
    });
  });
});
