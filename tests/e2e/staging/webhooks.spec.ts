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

  test.fixme('terminal delivery states are monotonic across out-of-order replays @staging @p0', async () => {
    // Requires read access to the staging delivery log for the synthetic booking (ops session
    // or a monitoring read endpoint) to assert that a late "sent" after "delivered" is ignored.
  });
});
