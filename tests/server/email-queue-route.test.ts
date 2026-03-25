import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireSessionMock = vi.hoisted(() => vi.fn());
const listUserRestaurantMembershipsMock = vi.hoisted(() => vi.fn());
const requireRestaurantMemberMock = vi.hoisted(() => vi.fn());
const getEmailQueueStatusMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/auth/guards', async () => {
  const actual = await vi.importActual<typeof import('@/server/auth/guards')>('@/server/auth/guards');
  return {
    ...actual,
    requireSession: requireSessionMock,
    listUserRestaurantMemberships: listUserRestaurantMembershipsMock,
    requireRestaurantMember: requireRestaurantMemberMock,
  };
});

vi.mock('@/server/queue/email', async () => {
  const actual = await vi.importActual<typeof import('@/server/queue/email')>('@/server/queue/email');
  return {
    ...actual,
    getEmailQueueStatus: getEmailQueueStatusMock,
  };
});

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

import { GET } from '@/src/app/api/ops/email-queue/route';

function buildRequest(search = '') {
  return new NextRequest(`https://www.nabatable.com/api/ops/email-queue${search}`, {
    method: 'GET',
  });
}

describe('GET /api/ops/email-queue', () => {
  beforeEach(() => {
    requireSessionMock.mockReset();
    listUserRestaurantMembershipsMock.mockReset();
    requireRestaurantMemberMock.mockReset();
    getEmailQueueStatusMock.mockReset();
    getServiceSupabaseClientMock.mockReset();

    requireSessionMock.mockResolvedValue({
      supabase: { mock: true },
      user: { id: 'user-1' },
    });
    listUserRestaurantMembershipsMock.mockResolvedValue([
      { restaurant_id: '11111111-1111-4111-8111-111111111111' },
    ]);
    requireRestaurantMemberMock.mockResolvedValue(undefined);
    getServiceSupabaseClientMock.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    });
    getEmailQueueStatusMock.mockResolvedValue({
      status: 'ok',
      provider: 'cloudflare',
      queue: {
        name: 'pending-booking-emails',
        dlqName: 'pending-booking-emails-dlq',
        counts: {
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0,
          delayed: 0,
          total: 0,
          dlq: 0,
        },
        jobs: {
          waiting: [],
          active: [],
          delayed: [],
          dlq: [],
        },
      },
      timestamp: '2026-03-24T10:00:00.000Z',
    });
  });

  it('does not enable fixture loading behavior for normal queue requests', async () => {
    const response = await GET(
      buildRequest('?restaurantId=11111111-1111-4111-8111-111111111111&page=1&pageSize=25'),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ ok: true });
    expect(getEmailQueueStatusMock).toHaveBeenCalledWith(true, { jobLimit: 'all' });
  });

  it('treats queueFixture=loading as the canonical authenticated loading fixture', async () => {
    const sleepSpy = vi.spyOn(globalThis, 'setTimeout');

    const response = await GET(
      buildRequest(
        '?restaurantId=11111111-1111-4111-8111-111111111111&page=1&pageSize=25&queueFixture=loading',
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ ok: true });
    expect(getEmailQueueStatusMock).toHaveBeenCalledWith(true, { jobLimit: 'all' });
    expect(sleepSpy).toHaveBeenCalledWith(expect.any(Function), 1200);
  });

  it('also honors fixture=loading for backwards-compatible queue validation paths', async () => {
    const sleepSpy = vi.spyOn(globalThis, 'setTimeout');

    const response = await GET(
      buildRequest('?restaurantId=11111111-1111-4111-8111-111111111111&page=1&pageSize=25&fixture=loading'),
    );

    expect(response.status).toBe(200);
    expect(getEmailQueueStatusMock).toHaveBeenCalledWith(true, { jobLimit: 'all' });
    expect(sleepSpy).toHaveBeenCalledWith(expect.any(Function), 1200);
  });
});
