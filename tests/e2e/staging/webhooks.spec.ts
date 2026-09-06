import { createHmac } from 'node:crypto';

import { stagingEnv } from './env';
import { expect, test } from './test';

const staging = stagingEnv();

function twilioSignature(url: string, form: Record<string, string>, authToken: string): string {
  const data = Object.entries(form)
    .sort(([a], [b]) => a.localeCompare(b))
    .reduce((acc, [key, value]) => acc + key + value, url);
  return createHmac('sha1', authToken).update(data).digest('base64');
}

test.describe('provider webhook signatures and replay', () => {
  test('Twilio SMS status webhook rejects invalid signatures @staging @p0 @security', async ({
    request,
  }) => {
    const response = await request.post(`${staging.publicUrl}/api/webhook/twilio/sms-status`, {
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'x-twilio-signature': 'invalid-signature',
      },
      form: { MessageSid: 'SM00000000000000000000000000000000', MessageStatus: 'delivered' },
      failOnStatusCode: false,
    });
    expect([401, 403]).toContain(response.status());
  });

  test('Resend webhook rejects requests without a valid svix signature @staging @p0 @security', async ({
    request,
  }) => {
    const response = await request.post(`${staging.publicUrl}/api/webhook/resend`, {
      headers: { 'content-type': 'application/json' },
      data: {
        type: 'email.delivered',
        created_at: new Date().toISOString(),
        data: { email_id: 'x', to: [] },
      },
      failOnStatusCode: false,
    });
    expect([400, 401, 403]).toContain(response.status());
  });

  test('valid Twilio signature is accepted and replays are idempotent @staging @p0', async ({
    request,
  }) => {
    const authToken = staging.optional.STAGING_TWILIO_AUTH_TOKEN;
    test.skip(!authToken, 'STAGING_TWILIO_AUTH_TOKEN not provided');
    const url = `${staging.publicUrl}/api/webhook/twilio/sms-status`;
    const form = {
      MessageSid: `SM${'0'.repeat(30)}ff`,
      MessageStatus: 'delivered',
      To: staging.guest.phone,
    };
    const signature = twilioSignature(url, form, authToken ?? '');
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await request.post(url, {
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'x-twilio-signature': signature,
        },
        form,
        failOnStatusCode: false,
      });
      statuses.push(response.status());
    }
    expect(statuses.every((status) => status < 500)).toBe(true);
    expect(statuses[0]).toBe(statuses[1]);
  });

  test('terminal delivery states are monotonic across out-of-order replays @staging @p0', async ({
    request,
  }) => {
    const attemptId = staging.optional.STAGING_SYNTHETIC_SMS_ATTEMPT_ID;
    const notificationId = staging.optional.STAGING_SYNTHETIC_SMS_NOTIFICATION_ID;
    const messageSid = staging.optional.STAGING_SYNTHETIC_SMS_MESSAGE_SID;
    const authToken = staging.optional.STAGING_TWILIO_AUTH_TOKEN;
    const rawCookies = staging.optional.STAGING_TENANT_B_SESSION_COOKIES;
    test.skip(
      !attemptId || !notificationId || !messageSid || !authToken || !rawCookies,
      'Requires an inert synthetic queued SMS attempt and authenticated tenant B session',
    );
    expect(staging.optional.STAGING_SMS_SINK_VERIFIED).toBe('true');
    expect(attemptId).toMatch(/^[0-9a-f-]{36}$/u);
    expect(notificationId).toMatch(/^[0-9a-f-]{36}$/u);
    expect(messageSid).toMatch(/^SM[0-9a-f]{32}$/u);
    const parsed: unknown = JSON.parse(rawCookies ?? '[]');
    if (!Array.isArray(parsed) || parsed.length === 0)
      throw new Error('Synthetic session cookies missing');
    const cookie = parsed
      .map((entry: unknown) => {
        if (
          !entry ||
          typeof entry !== 'object' ||
          !('name' in entry) ||
          !('value' in entry) ||
          typeof entry.name !== 'string' ||
          typeof entry.value !== 'string' ||
          !/^sb-[a-z0-9-]+-auth-token(?:\.\d+)?$/u.test(entry.name) ||
          /[;\r\n]/u.test(entry.value)
        ) {
          throw new Error('Invalid synthetic session cookie shape');
        }
        return `${entry.name}=${entry.value}`;
      })
      .join('; ');
    const readCurrent = async () => {
      const response = await request.get(
        `${staging.opsUrl}/api/ops/sms-delivery?restaurantId=${staging.tenantB.id}&range=24h&pageSize=200&channel=sms`,
        {
          headers: { cookie },
          maxRedirects: 0,
        },
      );
      expect(response.status()).toBe(200);
      const body = (await response.json()) as {
        attempts?: Array<{
          logicalNotificationId?: string;
          messageSid?: string;
          currentStatus?: string;
          currentProviderStatus?: string;
        }>;
      };
      const matching = body.attempts?.filter(
        (attempt) =>
          attempt.logicalNotificationId === notificationId && attempt.messageSid === messageSid,
      );
      expect(matching?.length).toBe(1);
      return matching![0]!;
    };
    expect((await readCurrent()).currentProviderStatus).toBe('queued');
    const url = `${staging.publicUrl}/api/webhook/twilio/sms-status?attempt=${attemptId}`;
    for (const status of ['delivered', 'sent', 'queued', 'delivered']) {
      const form = { MessageSid: messageSid ?? '', MessageStatus: status, To: staging.guest.phone };
      const response = await request.post(url, {
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'x-twilio-signature': twilioSignature(url, form, authToken ?? ''),
        },
        form,
        maxRedirects: 0,
      });
      expect(response.status()).toBe(200);
      expect(await response.json()).toMatchObject({ success: true });
      const persisted = await readCurrent();
      expect(persisted.currentStatus).toBe('delivered');
      expect(persisted.currentProviderStatus).toBe('delivered');
    }
  });
});
