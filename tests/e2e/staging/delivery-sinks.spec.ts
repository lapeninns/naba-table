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

  test.fixme('email retry, idempotency and DLQ are observable through the sink @staging @worker', async () => {
    // Requires STAGING_DELIVERY_SINK_URL exposing captured Resend/Twilio calls for the synthetic
    // booking (retry count, idempotency key reuse, DLQ arrival). Sink service not provisioned.
  });

  test.fixme('WhatsApp-first summary falls back to SMS via the sink @staging @worker', async () => {
    // Requires the delivery sink plus a Twilio test credential set on the staging worker;
    // DELIVERY_MODE=sink currently short-circuits sends so channel fallback cannot be observed.
  });
});
