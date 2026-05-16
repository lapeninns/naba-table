import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('resend', () => ({
  Resend: vi.fn(function ResendMock() {
    return {
      webhooks: {
        verify: vi.fn(),
      },
    };
  }),
}));

process.env.RESEND_WEBHOOK_SECRET = 'webhook-secret';

import { POST } from '@/src/app/api/webhook/resend/route';

function buildRequest(headers: HeadersInit = {}) {
  return {
    headers: new Headers(headers),
    text: vi.fn().mockResolvedValue('{}'),
  };
}

describe('resend webhook route', () => {
  beforeEach(() => {
    process.env.RESEND_WEBHOOK_SECRET = 'webhook-secret';
  });

  it('rejects missing verification headers before reading the body', async () => {
    const request = buildRequest();

    const response = await POST(request as never);

    expect(response.status).toBe(401);
    expect(request.text).not.toHaveBeenCalled();
  });

  it('rejects oversized signed webhook bodies before reading the body', async () => {
    const request = buildRequest({
      'svix-id': 'msg_1',
      'svix-timestamp': '1710000000',
      'svix-signature': 'v1,sig',
      'content-length': String(300 * 1024),
    });

    const response = await POST(request as never);

    expect(response.status).toBe(413);
    expect(request.text).not.toHaveBeenCalled();
  });
});
