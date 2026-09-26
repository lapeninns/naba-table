import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const SECRET = 'test-secret-unsub';

const mockEnv = vi.hoisted(() => ({
  // Inlined (not `SECRET`) because vi.hoisted runs before module-level consts initialize.
  security: { sessionRecoveryAccessTokenSecret: 'test-secret-unsub' as string | null },
}));
const addEmailToSuppressionListMock = vi.hoisted(() => vi.fn());
const recordObservabilityEventMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/env', () => ({ env: mockEnv }));
vi.mock('@/server/emails/email-suppression-list', () => ({
  addEmailToSuppressionList: addEmailToSuppressionListMock,
}));
vi.mock('@/server/observability', () => ({
  recordObservabilityEvent: recordObservabilityEventMock,
}));

import { createUnsubscribeToken } from '@/server/emails/unsubscribe-token';
import { GET, POST } from '@/src/app/api/email/unsubscribe/route';

const BASE = 'https://www.nabatable.com/api/email/unsubscribe';

function urlWithToken(token: string): string {
  return `${BASE}?token=${encodeURIComponent(token)}`;
}

function validToken(email = 'guest@example.com'): string {
  return createUnsubscribeToken({ email, secret: SECRET });
}

beforeEach(() => {
  addEmailToSuppressionListMock.mockReset();
  addEmailToSuppressionListMock.mockResolvedValue({ suppressed: true });
  recordObservabilityEventMock.mockReset();
  recordObservabilityEventMock.mockResolvedValue(undefined);
});

afterEach(() => {
  mockEnv.security.sessionRecoveryAccessTokenSecret = SECRET;
});

describe('POST /api/email/unsubscribe (one-click)', () => {
  it('suppresses the recipient and returns 200 JSON for programmatic callers', async () => {
    const res = await POST(new NextRequest(urlWithToken(validToken()), { method: 'POST' }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ success: true });
    expect(addEmailToSuppressionListMock).toHaveBeenCalledWith(
      'guest@example.com',
      'one_click',
      expect.any(Object),
    );
  });

  it('returns an HTML confirmation when the caller accepts text/html', async () => {
    const res = await POST(
      new NextRequest(urlWithToken(validToken()), {
        method: 'POST',
        headers: { accept: 'text/html' },
      }),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(await res.text()).toContain('unsubscribed');
  });

  it('rejects an invalid token without suppressing', async () => {
    const res = await POST(new NextRequest(urlWithToken('garbage'), { method: 'POST' }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: 'Invalid or expired unsubscribe link.',
      code: 'INVALID_UNSUBSCRIBE_LINK',
      message: 'Invalid or expired unsubscribe link.',
    });
    expect(addEmailToSuppressionListMock).not.toHaveBeenCalled();
  });

  it('returns 503 when no signing secret is configured', async () => {
    mockEnv.security.sessionRecoveryAccessTokenSecret = null;
    const res = await POST(new NextRequest(urlWithToken('anything'), { method: 'POST' }));

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({
      code: 'UNSUBSCRIBE_NOT_CONFIGURED',
      retryable: true,
    });
    expect(addEmailToSuppressionListMock).not.toHaveBeenCalled();
  });

  it('returns 500 when suppression storage fails', async () => {
    addEmailToSuppressionListMock.mockRejectedValue(
      new Error('SECRET_DB_DETAIL suppression insert failed for guest@example.com'),
    );
    const res = await POST(new NextRequest(urlWithToken(validToken()), { method: 'POST' }));

    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).not.toContain('SECRET_DB_DETAIL');
    expect(text).not.toContain('guest@example.com');
    expect(JSON.parse(text)).toMatchObject({ code: 'INTERNAL_ERROR' });
  });
});

describe('GET /api/email/unsubscribe (confirmation page)', () => {
  it('renders a confirmation page WITHOUT mutating state', async () => {
    const res = await GET(new NextRequest(urlWithToken(validToken()), { method: 'GET' }));

    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('guest@example.com');
    expect(body).toContain('<form');
    // Critical: a GET (e.g. from a link scanner) must not unsubscribe anyone.
    expect(addEmailToSuppressionListMock).not.toHaveBeenCalled();
  });

  it('renders an invalid-link page for a bad token', async () => {
    const res = await GET(new NextRequest(urlWithToken('garbage'), { method: 'GET' }));

    expect(res.status).toBe(400);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(addEmailToSuppressionListMock).not.toHaveBeenCalled();
  });
});
