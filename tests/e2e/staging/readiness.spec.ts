import { stagingEnv } from './env';
import { expect, test } from './test';

const staging = stagingEnv();

test.describe('staging readiness and revision', () => {
  for (const [label, origin] of [
    ['public', staging.publicUrl],
    ['ops', staging.opsUrl],
  ] as const) {
    test(`${label} host rejects unauthenticated readiness @staging @p0`, async ({ request }) => {
      const response = await request.get(`${origin}/api/ready`, { failOnStatusCode: false });
      expect(response.status()).toBe(401);
    });

    test(`${label} host reports the exact revision under test @staging @p0`, async ({
      request,
    }) => {
      const response = await request.get(`${origin}/api/ready`, {
        headers: { authorization: `Bearer ${staging.monitoringToken}` },
        failOnStatusCode: false,
      });
      expect(response.status()).toBe(200);
      const body = (await response.json()) as { revision?: unknown; status?: unknown };
      expect(body.revision).toBe(staging.expectedRevision);
      expect(body.status).toBe('ok');
    });
  }

  for (const [name, key] of [
    ['short links', 'STAGING_SHORT_LINKS_URL'],
    ['email gateway', 'STAGING_EMAIL_GATEWAY_URL'],
    ['sms gateway', 'STAGING_SMS_GATEWAY_URL'],
  ] as const) {
    test(`${name} worker reports the exact revision under test @staging @worker`, async ({
      request,
    }) => {
      const origin = staging.optional[key];
      test.skip(!origin, `${key} not provided`);
      const unauthenticated = await request.get(`${origin}/ready`, { failOnStatusCode: false });
      expect(unauthenticated.status()).toBe(401);
      const response = await request.get(`${origin}/ready`, {
        headers: { authorization: `Bearer ${staging.monitoringToken}` },
        failOnStatusCode: false,
      });
      expect(response.status()).toBe(200);
      const body = (await response.json()) as { revision?: unknown };
      expect(body.revision).toBe(staging.expectedRevision);
    });
  }
});
