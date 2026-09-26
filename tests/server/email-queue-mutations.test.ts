import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';


const requireSessionMock = vi.hoisted(() => vi.fn());
const requireRestaurantMemberMock = vi.hoisted(() => vi.fn());
const cancelRestaurantEmailQueueJobMock = vi.hoisted(() => vi.fn());
const requeueRestaurantEmailQueueJobMock = vi.hoisted(() => vi.fn());
const requireApiRateLimitMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/auth/guards', async () => {
  const actual =
    await vi.importActual<typeof GuardsModule>('@/server/auth/guards');
  return {
    ...actual,
    requireSession: requireSessionMock,
    requireRestaurantMember: requireRestaurantMemberMock,
  };
});

vi.mock('@/server/queue/email', () => ({
  cancelRestaurantEmailQueueJob: cancelRestaurantEmailQueueJobMock,
  requeueRestaurantEmailQueueJob: requeueRestaurantEmailQueueJobMock,
}));

vi.mock('@/server/security/api-rate-limit', () => ({
  requireApiRateLimit: requireApiRateLimitMock,
}));

import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '@/lib/security/csrf';
import { GuardError } from '@/server/auth/guards';
import { POST as cancelPost } from '@/src/app/api/ops/email-queue/[jobId]/cancel/route';
import { POST as requeuePost } from '@/src/app/api/ops/email-queue/[jobId]/requeue/route';

import type * as GuardsModule from '@/server/auth/guards';

const CSRF_TOKEN = 'email-queue-csrf';
const RESTAURANT_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const JOB_ID = 'booking-confirmation:booking-1';

function buildRequest(path: string, body: unknown) {
  return new NextRequest(`https://www.nabatable.com${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      [CSRF_HEADER_NAME]: CSRF_TOKEN,
      cookie: `${CSRF_COOKIE_NAME}=${CSRF_TOKEN}`,
    },
    body: JSON.stringify(body),
  });
}

describe('ops email queue mutations', () => {
  beforeEach(() => {
    requireSessionMock.mockReset().mockResolvedValue({
      supabase: { mock: true },
      user: { id: 'user-1' },
    });
    requireRestaurantMemberMock.mockReset().mockResolvedValue(undefined);
    cancelRestaurantEmailQueueJobMock.mockReset().mockResolvedValue('cancelled');
    requeueRestaurantEmailQueueJobMock.mockReset().mockResolvedValue('requeued');
    requireApiRateLimitMock.mockReset().mockResolvedValue(null);
  });

  it('cancels a queued job for a restaurant member', async () => {
    const response = await cancelPost(
      buildRequest(`/api/ops/email-queue/${encodeURIComponent(JOB_ID)}/cancel`, {
        restaurantId: RESTAURANT_ID,
      }),
      { params: Promise.resolve({ jobId: JOB_ID }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ ok: true, action: 'cancelled', jobId: JOB_ID });
    expect(cancelRestaurantEmailQueueJobMock).toHaveBeenCalledWith({
      jobId: JOB_ID,
      restaurantId: RESTAURANT_ID,
    });
  });

  it('returns uniform 404 when cancel membership fails', async () => {
    requireRestaurantMemberMock.mockRejectedValue(
      new GuardError({ status: 403, code: 'FORBIDDEN', message: 'Forbidden' }),
    );

    const response = await cancelPost(
      buildRequest(`/api/ops/email-queue/${encodeURIComponent(JOB_ID)}/cancel`, {
        restaurantId: RESTAURANT_ID,
      }),
      { params: Promise.resolve({ jobId: JOB_ID }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toMatchObject({ code: 'NOT_FOUND', message: expect.any(String) });
  });

  it('requeues a failed job', async () => {
    const response = await requeuePost(
      buildRequest(`/api/ops/email-queue/${encodeURIComponent(JOB_ID)}/requeue`, {
        restaurantId: RESTAURANT_ID,
      }),
      { params: Promise.resolve({ jobId: JOB_ID }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ ok: true, action: 'requeued', jobId: JOB_ID });
  });

  it('returns 409 when job is not requeueable', async () => {
    requeueRestaurantEmailQueueJobMock.mockResolvedValue('not_requeueable');

    const response = await requeuePost(
      buildRequest(`/api/ops/email-queue/${encodeURIComponent(JOB_ID)}/requeue`, {
        restaurantId: RESTAURANT_ID,
      }),
      { params: Promise.resolve({ jobId: JOB_ID }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toMatchObject({ code: 'NOT_REQUEUEABLE', error: payload.message });
  });

  it('returns 409 JOB_IN_PROGRESS when the job is being processed', async () => {
    cancelRestaurantEmailQueueJobMock.mockResolvedValue('in_progress');

    const response = await cancelPost(
      buildRequest(`/api/ops/email-queue/${encodeURIComponent(JOB_ID)}/cancel`, {
        restaurantId: RESTAURANT_ID,
      }),
      { params: Promise.resolve({ jobId: JOB_ID }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toMatchObject({ code: 'JOB_IN_PROGRESS' });
  });

  it('returns 409 JOB_NOT_CANCELLABLE for a finished job', async () => {
    cancelRestaurantEmailQueueJobMock.mockResolvedValue('not_cancellable');

    const response = await cancelPost(
      buildRequest(`/api/ops/email-queue/${encodeURIComponent(JOB_ID)}/cancel`, {
        restaurantId: RESTAURANT_ID,
      }),
      { params: Promise.resolve({ jobId: JOB_ID }) },
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'JOB_NOT_CANCELLABLE' });
  });

  it('returns field errors for an invalid body', async () => {
    const response = await cancelPost(
      buildRequest(`/api/ops/email-queue/${encodeURIComponent(JOB_ID)}/cancel`, {
        restaurantId: 'nope',
      }),
      { params: Promise.resolve({ jobId: JOB_ID }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(payload.fields).toHaveProperty('restaurantId');
  });

  it('never leaks database error text in a 500', async () => {
    requeueRestaurantEmailQueueJobMock.mockRejectedValue(
      new Error('relation "email_dispatch_intents" does not exist'),
    );

    const response = await requeuePost(
      buildRequest(`/api/ops/email-queue/${encodeURIComponent(JOB_ID)}/requeue`, {
        restaurantId: RESTAURANT_ID,
      }),
      { params: Promise.resolve({ jobId: JOB_ID }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(payload)).not.toContain('email_dispatch_intents');
  });
});
