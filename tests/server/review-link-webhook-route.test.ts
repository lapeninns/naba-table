import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpcMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: () => ({ rpc: rpcMock }),
}));

process.env.BOOKING_SHORT_LINKS_INTERNAL_TOKEN = 'review-link-secret';

import { POST } from '@/src/app/api/webhook/review-link/route';

const payload = {
  eventId: '11111111-1111-4111-8111-111111111111',
  bookingId: '22222222-2222-4222-8222-222222222222',
  restaurantId: '33333333-3333-4333-8333-333333333333',
  channel: 'whatsapp',
  occurredAt: '2026-09-05T10:05:00.000Z',
} as const;

function request(token: string, body: unknown = payload): Request {
  return new Request('https://nabatable.com/api/webhook/review-link', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

describe('review link tracking webhook', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({ data: true, error: null });
  });

  it('records an authenticated click through the tenant-validating RPC', async () => {
    const response = await POST(request('review-link-secret'));

    expect(response.status).toBe(204);
    expect(rpcMock).toHaveBeenCalledWith('record_review_link_click_v1', {
      p_booking_id: payload.bookingId,
      p_channel: 'whatsapp',
      p_event_id: payload.eventId,
      p_occurred_at: payload.occurredAt,
      p_restaurant_id: payload.restaurantId,
    });
  });

  it('rejects invalid credentials and malformed identities before persistence', async () => {
    const unauthorized = await POST(request('wrong-secret'));
    const malformed = await POST(
      request('review-link-secret', { ...payload, restaurantId: 'not-a-uuid' }),
    );

    expect([unauthorized.status, malformed.status]).toEqual([401, 400]);
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
