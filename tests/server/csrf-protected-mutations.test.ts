import { NextRequest, NextResponse } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '@/lib/security/csrf';
import { withCsrfProtectedMutation } from '@/server/security/csrf';
import { POST as postNoShow } from '@/src/app/api/ops/bookings/[id]/no-show/route';
import { POST as postProfileImage } from '@/src/app/api/profile/image/route';

const TOKEN = 'csrf-token-for-tests';

function csrfHeaders(includeHeader = true, includeCookie = true): Headers {
  const headers = new Headers();
  if (includeHeader) {
    headers.set(CSRF_HEADER_NAME, TOKEN);
  }
  if (includeCookie) {
    headers.set('cookie', `${CSRF_COOKIE_NAME}=${TOKEN}`);
  }
  return headers;
}

describe('CSRF-protected mutations', () => {
  it('rejects missing CSRF before running the mutation handler', async () => {
    const handler = vi.fn(() => NextResponse.json({ ok: true }));

    const response = await withCsrfProtectedMutation(
      new NextRequest('https://app.nabatable.com/api/ops/example', { method: 'POST' }),
      handler,
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe('CSRF_INVALID');
    expect(handler).not.toHaveBeenCalled();
  });

  it('rejects invalid CSRF before running the mutation handler', async () => {
    const handler = vi.fn(() => NextResponse.json({ ok: true }));
    const headers = csrfHeaders();
    headers.set(CSRF_HEADER_NAME, 'different-token');

    const response = await withCsrfProtectedMutation(
      new NextRequest('https://app.nabatable.com/api/ops/example', { method: 'PATCH', headers }),
      handler,
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe('CSRF_INVALID');
    expect(handler).not.toHaveBeenCalled();
  });

  it('allows valid CSRF through to the mutation handler', async () => {
    const handler = vi.fn(() => NextResponse.json({ ok: true }));

    const response = await withCsrfProtectedMutation(
      new NextRequest('https://app.nabatable.com/api/ops/example', {
        method: 'DELETE',
        headers: csrfHeaders(),
      }),
      handler,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not parse JSON bodies on booking lifecycle CSRF failure', async () => {
    const request = new NextRequest('https://app.nabatable.com/api/ops/bookings/booking-1/no-show', {
      method: 'POST',
      body: JSON.stringify({ reason: 'forged' }),
    });
    const jsonSpy = vi.spyOn(request, 'json');

    const response = await postNoShow(request, {
      params: Promise.resolve({ id: 'booking-1' }),
    });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe('CSRF_INVALID');
    expect(jsonSpy).not.toHaveBeenCalled();
  });

  it('does not parse form-data bodies on avatar upload CSRF failure', async () => {
    const formData = new FormData();
    formData.set('file', new Blob(['avatar'], { type: 'image/png' }), 'avatar.png');
    const request = new NextRequest('https://www.nabatable.com/api/profile/image', {
      method: 'POST',
      body: formData,
    });
    const formDataSpy = vi.spyOn(request, 'formData');

    const response = await postProfileImage(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe('CSRF_INVALID');
    expect(formDataSpy).not.toHaveBeenCalled();
  });
});
