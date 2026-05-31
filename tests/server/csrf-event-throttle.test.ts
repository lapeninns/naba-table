import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const recordSecurityEventMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/security/events', () => ({
  recordSecurityEvent: recordSecurityEventMock,
}));

import { withCsrfProtectedMutation } from '@/server/security/csrf';

describe('CSRF failure event throttling', () => {
  beforeEach(() => {
    recordSecurityEventMock.mockReset();
  });

  it('coalesces repeated missing-token failures for the same route bucket', async () => {
    const handler = vi.fn();
    const first = new NextRequest('https://app.nabatable.com/api/ops/example', {
      method: 'POST',
    });
    const second = new NextRequest('https://app.nabatable.com/api/ops/example', {
      method: 'POST',
    });

    await withCsrfProtectedMutation(first, handler);
    await withCsrfProtectedMutation(second, handler);

    expect(recordSecurityEventMock).toHaveBeenCalledTimes(1);
    expect(handler).not.toHaveBeenCalled();
  });

  it('coalesces missing-token failures across tokenized dynamic route segments', async () => {
    const handler = vi.fn();
    const first = new NextRequest(
      'https://app.nabatable.com/api/team/invitations/random-token-value-0001/accept',
      {
        method: 'POST',
      },
    );
    const second = new NextRequest(
      'https://app.nabatable.com/api/team/invitations/random-token-value-0002/accept',
      {
        method: 'POST',
      },
    );

    await withCsrfProtectedMutation(first, handler);
    await withCsrfProtectedMutation(second, handler);

    expect(recordSecurityEventMock).toHaveBeenCalledTimes(1);
    expect(handler).not.toHaveBeenCalled();
  });
});
