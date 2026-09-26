import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { NextRequest } from 'next/server';

vi.mock('@/src/instrumentation', () => ({ flushPosthogLogsAfterResponse: vi.fn() }));
vi.mock('@/lib/posthog/server', () => ({ captureServerException: vi.fn() }));
vi.mock('@/server/emails/email-delivery-log', () => ({
  recordEmailDeliveryLog: vi.fn(),
  findLatestEmailDeliveryByMessageId: vi.fn(),
}));
vi.mock('@/server/emails/email-suppression-list', () => ({ addEmailToSuppressionList: vi.fn() }));
vi.mock('@/server/emails/recipient-suppression', () => ({ suppressProfilesByEmail: vi.fn() }));
vi.mock('@/server/observability', () => ({ recordObservabilityEvent: vi.fn() }));
vi.mock('@/server/reviews/journeys', () => ({ recordReviewRequestEvent: vi.fn() }));

const signingKey = Buffer.from('staging-webhook-signature-regression-key');
const payload = JSON.stringify({ type: 'email.delivered', data: { email_id: 'test', to: [] } });

function request(body: string, timestamp = Math.floor(Date.now() / 1000)) {
  const id = 'msg_signature_regression';
  const signature = createHmac('sha256', signingKey)
    .update(`${id}.${timestamp}.${payload}`)
    .digest('base64');
  return new Request('https://nabatable-staging.vercel.app/api/webhook/resend', {
    method: 'POST',
    headers: {
      'svix-id': id,
      'svix-timestamp': String(timestamp),
      'svix-signature': `v1,${signature}`,
      'content-length': String(Buffer.byteLength(body)),
    },
    body,
  }) as NextRequest;
}

describe('Resend webhook local signature verification without sending credentials', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('RESEND_API_KEY', undefined);
    vi.stubEnv('RESEND_WEBHOOK_SECRET', `whsec_${signingKey.toString('base64')}`);
  });
  afterEach(() => vi.unstubAllEnvs());

  it('imports without an API key and accepts a correctly signed raw payload', async () => {
    const { POST } = await import('@/src/app/api/webhook/resend/route');
    const result = await POST(request(payload));
    expect(result.status).toBe(400);
    expect(await result.json()).toMatchObject({
      code: 'NO_RECIPIENT',
      error: 'No recipient email found.',
    });
  });

  it('rejects a tampered body', async () => {
    const { POST } = await import('@/src/app/api/webhook/resend/route');
    const result = await POST(request(payload + ' '));
    expect(result.status).toBe(401);
  });

  it('rejects a signed replay outside the timestamp tolerance', async () => {
    const { POST } = await import('@/src/app/api/webhook/resend/route');
    const result = await POST(request(payload, Math.floor(Date.now() / 1000) - 600));
    expect(result.status).toBe(401);
  });
});
