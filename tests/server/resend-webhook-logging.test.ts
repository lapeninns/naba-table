import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as LoggerModule from '@/lib/logger';
import type { NextRequest } from 'next/server';

const loggerMock = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/lib/logger', async (importOriginal) => {
  const actual = await importOriginal<typeof LoggerModule>();
  return { ...actual, logger: loggerMock };
});
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

const payload = JSON.stringify({ type: 'email.delivered', data: { email_id: 'e', to: [] } });

function request(headers: Record<string, string>) {
  return new Request('https://example.test/api/webhook/resend', {
    method: 'POST',
    headers: { 'content-length': String(Buffer.byteLength(payload)), ...headers },
    body: payload,
  }) as NextRequest;
}

describe('Resend webhook logging goes through lib/logger', () => {
  const consoleWarn = vi.spyOn(console, 'warn');
  const consoleError = vi.spyOn(console, 'error');

  beforeEach(() => {
    vi.resetModules();
    Object.values(loggerMock).forEach((fn) => fn.mockReset());
    consoleWarn.mockReset().mockImplementation(() => undefined);
    consoleError.mockReset().mockImplementation(() => undefined);
  });
  afterEach(() => vi.unstubAllEnvs());

  it('logs a missing webhook secret with the structured logger, not console', async () => {
    vi.stubEnv('RESEND_WEBHOOK_SECRET', '');
    const { POST } = await import('@/src/app/api/webhook/resend/route');
    const response = await POST(request({}));

    expect(response.status).toBe(503);
    expect(loggerMock.error).toHaveBeenCalledWith(
      'webhook.resend.secret_missing',
      expect.objectContaining({ route: '/api/webhook/resend' }),
    );
    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleWarn).not.toHaveBeenCalled();
  });

  it('logs missing svix headers with the structured logger, not console', async () => {
    vi.stubEnv('RESEND_WEBHOOK_SECRET', `whsec_${Buffer.from('k').toString('base64')}`);
    const { POST } = await import('@/src/app/api/webhook/resend/route');
    const response = await POST(request({}));

    expect(response.status).toBe(401);
    expect(loggerMock.warn).toHaveBeenCalledWith(
      'webhook.resend.missing_signature_headers',
      expect.objectContaining({ route: '/api/webhook/resend' }),
    );
    expect(consoleWarn).not.toHaveBeenCalled();
  });

  it('logs an invalid signature with the structured logger, not console', async () => {
    vi.stubEnv('RESEND_WEBHOOK_SECRET', `whsec_${Buffer.from('k').toString('base64')}`);
    const { POST } = await import('@/src/app/api/webhook/resend/route');
    const response = await POST(
      request({
        'svix-id': 'msg_1',
        'svix-timestamp': String(Math.floor(Date.now() / 1000)),
        'svix-signature': 'v1,AAAA',
      }),
    );

    expect(response.status).toBe(401);
    expect(loggerMock.warn).toHaveBeenCalledWith(
      'webhook.resend.invalid_signature',
      expect.objectContaining({ route: '/api/webhook/resend' }),
    );
    expect(consoleWarn).not.toHaveBeenCalled();
  });
});
