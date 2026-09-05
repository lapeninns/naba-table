import { expect, test } from '@playwright/test';

import { futureBookingDate, stagingEnv } from './env';

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
    expect([200, 202, 404, 409]).toContain(response.status());
    const text = await response.text();
    expect(text).not.toMatch(/"messageSid":\s*"[A-Z]{2}[0-9a-f]{32}"/u);
  });

  test('email gateway requires the gateway token @staging @worker @security', async ({
    request,
  }) => {
    const origin = staging.optional.STAGING_EMAIL_GATEWAY_URL;
    test.skip(!origin, 'STAGING_EMAIL_GATEWAY_URL not provided');
    const response = await request.get(`${origin}/status`, { failOnStatusCode: false });
    expect(response.status()).toBe(401);
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
