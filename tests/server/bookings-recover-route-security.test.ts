import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const validateSessionRecoveryAccessTokenMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/env', () => ({
  env: {
    security: {
      sessionRecoveryAccessTokenSecret: 'test-secret',
    },
  },
}));

vi.mock('@/server/security/session-recovery-access-token', () => ({
  validateSessionRecoveryAccessToken: validateSessionRecoveryAccessTokenMock,
}));

import { GET } from '@/src/app/(public)/bookings/recover/route';

describe('GET /bookings/recover security', () => {
  beforeEach(() => {
    validateSessionRecoveryAccessTokenMock.mockReset().mockReturnValue({
      ok: true,
      payload: { exp: Math.floor(Date.now() / 1000) + 900 },
    });
  });

  it('falls back to root for backslash-normalized next redirects', async () => {
    const response = await GET(
      new NextRequest(
        'https://www.nabatable.com/bookings/recover?access_token=valid-token&next=%2F%5Cevil.example%2Fcapture',
      ),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://www.nabatable.com/');
    expect(validateSessionRecoveryAccessTokenMock).toHaveBeenCalledWith('valid-token', {
      secret: 'test-secret',
    });
  });
});
