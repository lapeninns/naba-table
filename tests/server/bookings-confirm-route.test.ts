import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

const serviceFromMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: vi.fn(() => ({ from: serviceFromMock })),
}));

import { GET, POST } from '@/src/app/api/bookings/confirm/route';

const VALID_LOOKING_TOKEN = 'a'.repeat(64);

describe('retired /api/bookings/confirm', () => {
  it('answers 410 for a query-string token without reading any booking data', async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(410);
    expect(body).toMatchObject({ code: 'CONFIRMATION_ENDPOINT_RETIRED' });
    expect(body).not.toHaveProperty('booking');
    expect(serviceFromMock).not.toHaveBeenCalled();
  });

  it('answers 410 with an sr_confirm cookie and clears the retired cookies', async () => {
    // The handler ignores the request entirely; the request below documents the case.
    void new NextRequest(
      `https://www.nabatable.com/api/bookings/confirm?token=${VALID_LOOKING_TOKEN}`,
      {
        headers: { cookie: `sr_confirm=${VALID_LOOKING_TOKEN}` },
      },
    );
    const response = await GET();
    const setCookie = response.headers.getSetCookie().join('\n');

    expect(response.status).toBe(410);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(setCookie).toMatch(/sr_confirm=;[^\n]*Path=\/api\/bookings\/confirm/);
    expect(setCookie).toMatch(/sr_access=;[^\n]*Max-Age=0/);
    expect(serviceFromMock).not.toHaveBeenCalled();
  });

  it('also retires POST', async () => {
    const response = await POST();
    expect(response.status).toBe(410);
  });
});
