import { randomUUID } from 'node:crypto';

import { futureBookingDate, stagingEnv } from './env';
import { expect, test } from './test';

const staging = stagingEnv();

test.describe('email/SMS/WhatsApp delivery through staging sinks', () => {
  test('SMS summary gateway refuses unauthenticated manual dispatch @staging @worker @security', async ({
    request,
  }) => {
    const origin = staging.optional.STAGING_SMS_GATEWAY_URL;
    test.skip(!origin, 'STAGING_SMS_GATEWAY_URL not provided');
    const response = await request.post(`${origin}/internal/dispatch-daily-summary`, {
      data: { restaurantId: staging.tenantA.id, dryRun: true },
      failOnStatusCode: false,
    });
    expect(response.status()).toBe(401);
  });

  test('SMS summary dry-run dispatch never sends and returns a preview @staging @worker', async ({
    request,
  }) => {
    const origin = staging.optional.STAGING_SMS_GATEWAY_URL;
    const token = staging.optional.STAGING_SMS_GATEWAY_INTERNAL_TOKEN;
    test.skip(
      !origin || !token,
      'STAGING_SMS_GATEWAY_URL / STAGING_SMS_GATEWAY_INTERNAL_TOKEN not provided',
    );
    const response = await request.post(`${origin}/internal/dispatch-daily-summary`, {
      headers: { authorization: `Bearer ${token ?? ''}` },
      data: { restaurantId: staging.tenantA.id, date: futureBookingDate(0), dryRun: true },
      failOnStatusCode: false,
    });
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      ok?: boolean;
      dryRun?: boolean;
      queued?: boolean;
      payload?: { restaurantId?: string; dryRun?: boolean };
      preview?: { restaurantId?: string; date?: string; message?: string };
    };
    expect(body).toMatchObject({ ok: true, dryRun: true });
    expect(body.queued).toBeUndefined();
    expect(body.payload).toMatchObject({ restaurantId: staging.tenantA.id, dryRun: true });
    expect(body.preview?.restaurantId).toBe(staging.tenantA.id);
    expect(body.preview?.date).toBe(futureBookingDate(0));
    expect(typeof body.preview?.message).toBe('string');
    expect(body.preview?.message?.length).toBeGreaterThan(0);
  });

  test('email gateway requires the gateway token @staging @worker @security', async ({
    request,
  }) => {
    const origin = staging.optional.STAGING_EMAIL_GATEWAY_URL;
    test.skip(!origin, 'STAGING_EMAIL_GATEWAY_URL not provided');
    const response = await request.get(`${origin}/status`, { failOnStatusCode: false });
    expect(response.status()).toBe(401);
  });

  test('email queue persists a delayed synthetic job, deduplicates it and removes it @staging @worker', async ({
    request,
  }) => {
    const origin = staging.optional.STAGING_EMAIL_GATEWAY_URL;
    const token = staging.optional.STAGING_EMAIL_GATEWAY_INTERNAL_TOKEN;
    test.skip(
      !origin || !token,
      'STAGING_EMAIL_GATEWAY_URL / STAGING_EMAIL_GATEWAY_INTERNAL_TOKEN not provided',
    );
    const headers = { authorization: `Bearer ${token ?? ''}` };
    const jobId = `staging-proof-${randomUUID()}`;
    // A nonexistent booking and unknown proof type cannot address a guest. A long delay
    // prevents normal processing, and finally removes this exact proof job only.
    const data = {
      jobId,
      delayMs: 24 * 60 * 60 * 1000,
      payload: { bookingId: randomUUID(), type: 'staging-proof-no-delivery' },
    };
    try {
      const enqueued = await request.post(`${origin}/messages`, { headers, data });
      expect(enqueued.status()).toBe(201);
      expect(await enqueued.json()).toMatchObject({ status: 'enqueued', duplicate: false, jobId });
      const duplicate = await request.post(`${origin}/messages`, { headers, data });
      expect(duplicate.status()).toBe(409);
      expect(await duplicate.json()).toMatchObject({ status: 'duplicate', duplicate: true, jobId });
      const status = await request.get(`${origin}/status?includeJobs=true&jobLimit=all`, {
        headers,
      });
      expect(status.status()).toBe(200);
      const body = (await status.json()) as {
        queue?: { jobs?: { delayed?: Array<{ id: string; status: string }> } };
      };
      const matching = body.queue?.jobs?.delayed?.filter((job) => job.id === jobId);
      expect(matching?.length).toBe(1);
      expect(matching?.[0]?.status).toBe('delayed');
    } finally {
      const removed = await request.delete(`${origin}/messages/${jobId}`, { headers });
      expect([200, 404]).toContain(removed.status());
    }
    const absent = await request.delete(`${origin}/messages/${jobId}`, { headers });
    expect(absent.status()).toBe(404);
    expect(await absent.json()).toMatchObject({ removed: false });
  });

  test('email consumer completes a nonexistent booking without delivery @staging @worker', async ({
    request,
  }) => {
    const origin = staging.optional.STAGING_EMAIL_GATEWAY_URL;
    const token = staging.optional.STAGING_EMAIL_GATEWAY_INTERNAL_TOKEN;
    test.skip(
      !origin || !token || staging.optional.STAGING_EMAIL_MOCK_VERIFIED !== 'true',
      'Requires gateway credentials and independently verified STAGING_EMAIL_MOCK_VERIFIED=true',
    );
    const headers = { authorization: `Bearer ${token ?? ''}` };
    type Snapshot = {
      queue: { counts: { completed: number }; jobs: Record<string, Array<{ id: string }>> };
    };
    const status = async () => {
      const response = await request.get(`${origin}/status?includeJobs=true&jobLimit=all`, {
        headers,
      });
      expect(response.status()).toBe(200);
      return (await response.json()) as Snapshot;
    };
    const before = await status();
    const jobId = `staging-consume-${randomUUID()}`;
    const data = {
      jobId,
      delayMs: 1000,
      attempts: 3,
      payload: {
        bookingId: randomUUID(),
        restaurantId: staging.tenantA.id,
        type: 'confirmation',
      },
    };
    try {
      const enqueued = await request.post(`${origin}/messages`, { headers, data });
      expect(enqueued.status()).toBe(201);
      await expect
        .poll(
          async () => {
            const drain = await request.post(`${origin}/drain`, {
              headers,
              data: { types: ['confirmation'], maxJobs: 1 },
            });
            expect(drain.status()).toBe(200);
            const batch = (await drain.json()) as {
              results?: Array<{ jobId: string; success: boolean; skipped?: boolean }>;
            };
            const own = batch.results?.find((result) => result.jobId === jobId);
            if (own) expect(own).toMatchObject({ success: true, skipped: true });
            const after = await status();
            const stillPresent = Object.values(after.queue.jobs)
              .flat()
              .some((job) => job.id === jobId);
            return !stillPresent && after.queue.counts.completed > before.queue.counts.completed;
          },
          { timeout: 45_000, intervals: [500, 1000, 2000] },
        )
        .toBe(true);
    } finally {
      await request.delete(`${origin}/messages/${jobId}`, { headers });
    }
  });

  test('invalid email type retries and persists in the DLQ without delivery @staging @worker', async ({
    request,
  }) => {
    const origin = staging.optional.STAGING_EMAIL_GATEWAY_URL;
    const token = staging.optional.STAGING_EMAIL_GATEWAY_INTERNAL_TOKEN;
    test.skip(!origin || !token, 'Requires staging email gateway credentials');
    const headers = { authorization: `Bearer ${token ?? ''}` };
    const jobId = `staging-dlq-${randomUUID()}`;
    const type = `staging-invalid-${randomUUID()}`;
    const data = {
      jobId,
      attempts: 2,
      backoff: { type: 'fixed', delay: 5000 },
      payload: { bookingId: randomUUID(), restaurantId: staging.tenantA.id, type },
    };
    const enqueue = await request.post(`${origin}/messages`, { headers, data });
    expect(enqueue.status()).toBe(201);
    let retryObserved = false;
    await expect
      .poll(
        async () => {
          const drain = await request.post(`${origin}/drain`, {
            headers,
            data: { types: [type], maxJobs: 1 },
          });
          expect(drain.status()).toBe(200);
          const response = await request.get(`${origin}/status?includeJobs=true&jobLimit=all`, {
            headers,
          });
          expect(response.status()).toBe(200);
          const snapshot = (await response.json()) as {
            queue: {
              jobs: Record<
                string,
                Array<{
                  id: string;
                  status: string;
                  payload: { cronAttemptsMade?: number; failedReason?: string };
                }>
              >;
            };
          };
          const delayed = snapshot.queue.jobs.delayed?.find((job) => job.id === jobId);
          if (delayed) {
            expect(delayed.payload.cronAttemptsMade).toBe(1);
            retryObserved = true;
          }
          const failed = snapshot.queue.jobs.dlq?.find((job) => job.id === jobId);
          return failed?.status === 'failed';
        },
        { timeout: 30_000, intervals: [250, 500, 1000] },
      )
      .toBe(true);
    expect(retryObserved, 'first failed attempt must be observed before terminal DLQ state').toBe(
      true,
    );
    const duplicate = await request.post(`${origin}/messages`, { headers, data });
    expect(duplicate.status()).toBe(409);
    // Keep this one synthetic terminal record as DLQ audit evidence. The public delete
    // endpoint intentionally deletes queued jobs only, not failed audit records.
  });

  test('SMS sink queue consumes a real queued job with no provider message @staging @worker', async ({
    request,
  }) => {
    const origin = staging.optional.STAGING_SMS_GATEWAY_URL;
    const token = staging.optional.STAGING_SMS_GATEWAY_INTERNAL_TOKEN;
    const date = staging.optional.STAGING_SMS_PROOF_DATE;
    test.skip(
      !origin || !token || !date || staging.optional.STAGING_SMS_SINK_VERIFIED !== 'true',
      'Requires gateway credentials, fresh STAGING_SMS_PROOF_DATE and independently verified STAGING_SMS_SINK_VERIFIED=true',
    );
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
    const headers = { authorization: `Bearer ${token ?? ''}` };
    const read = async () => {
      const response = await request.post(`${origin}/internal/dispatch-daily-summary`, {
        headers,
        data: { restaurantId: staging.tenantB.id, date, dryRun: true, force: false },
      });
      expect(response.status()).toBe(200);
      const result = (await response.json()) as {
        idempotency: { status: string; sentAt: string | null; providerMessageId: string | null };
      };
      return result.idempotency;
    };
    expect(
      (await read()).status,
      'use a fresh synthetic date; never reset an existing summary',
    ).toBe('idle');
    const queued = await request.post(`${origin}/internal/dispatch-daily-summary`, {
      headers,
      data: { restaurantId: staging.tenantB.id, date, dryRun: false, force: false },
    });
    expect(queued.status()).toBe(202);
    expect(await queued.json()).toMatchObject({ queued: true, payload: { dryRun: false } });
    await expect
      .poll(async () => (await read()).status, { timeout: 45_000, intervals: [1000, 2000, 5000] })
      .toBe('sent');
    const completed = await read();
    expect(completed.providerMessageId).toBeNull();
    expect(Number.isFinite(Date.parse(completed.sentAt ?? ''))).toBe(true);
  });

  test.fixme('WhatsApp-first summary falls back to SMS via the sink @staging @worker', async () => {
    // Requires the delivery sink plus a Twilio test credential set on the staging worker;
    // DELIVERY_MODE=sink currently short-circuits sends so channel fallback cannot be observed.
  });
});
