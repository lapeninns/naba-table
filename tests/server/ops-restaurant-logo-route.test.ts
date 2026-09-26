import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const requireApiRateLimitMock = vi.hoisted(() => vi.fn());
const requireAdminMembershipMock = vi.hoisted(() => vi.fn());
const updateRestaurantMock = vi.hoisted(() => vi.fn());
const loggerWarnMock = vi.hoisted(() => vi.fn());
const loggerErrorMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/logger', async (importOriginal) => ({
  ...(await importOriginal<typeof LoggerModule>()),
  logger: { error: loggerErrorMock, warn: loggerWarnMock, info: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/posthog/server', () => ({ captureServerException: vi.fn() }));

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: getRouteHandlerSupabaseClientMock,
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

vi.mock('@/server/security/api-rate-limit', () => ({
  requireApiRateLimit: requireApiRateLimitMock,
}));

vi.mock('@/server/security/csrf', () => ({
  withCsrfProtectedMutation: vi.fn((_req: unknown, handler: () => unknown) => handler()),
}));

vi.mock('@/server/team/access', () => ({
  requireAdminMembership: requireAdminMembershipMock,
}));

vi.mock('@/server/restaurants/update', () => ({
  updateRestaurant: updateRestaurantMock,
}));

import { DELETE, POST } from '@/src/app/api/ops/restaurants/[id]/logo/route';

import type * as LoggerModule from '@/lib/logger';

const RESTAURANT_ID = '22222222-2222-4222-8222-222222222222';
const STORAGE_BASE = 'https://project.supabase.co/storage/v1/object/public/restaurant-branding';
const PREVIOUS_URL = `${STORAGE_BASE}/${RESTAURANT_ID}/logo?v=abc`;

function updatedRestaurant(logoUrl: string | null) {
  return {
    id: RESTAURANT_ID,
    name: 'The Bell',
    slug: 'the-bell',
    isActive: true,
    timezone: 'Europe/London',
    capacity: 40,
    contactEmail: null,
    contactPhone: null,
    address: null,
    managerDailySummaryEnabled: false,
    managerWhatsappEnabled: false,
    managerName: null,
    managerNotificationPhone: null,
    googleMapUrl: null,
    googleReviewUrl: null,
    bookingPolicy: null,
    logoUrl,
    emailSendReminder24h: true,
    emailSendReminderShort: true,
    emailSendReviewRequest: true,
    reservationIntervalMinutes: 15,
    reservationDefaultDurationMinutes: 90,
    reservationLastSeatingBufferMinutes: 15,
    reservationLifecycleGraceMinutes: 15,
    businessDescription: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-09-26T10:00:00.000Z',
  };
}

function uploadRequest(contentType = 'image/png') {
  const file = new File(['<image-bytes>'], 'logo.png', { type: contentType });
  Object.defineProperty(file, 'arrayBuffer', {
    value: async () => new TextEncoder().encode('<image-bytes>').buffer,
  });
  const formData = new FormData();
  formData.set('file', file);
  const request = new NextRequest(
    `https://app.nabatable.com/api/ops/restaurants/${RESTAURANT_ID}/logo`,
    {
      method: 'POST',
    },
  );
  vi.spyOn(request, 'formData').mockResolvedValue(formData);
  return request;
}

function deleteRequest() {
  return new NextRequest(`https://app.nabatable.com/api/ops/restaurants/${RESTAURANT_ID}/logo`, {
    method: 'DELETE',
  });
}

const context = () => ({ params: Promise.resolve({ id: RESTAURANT_ID }) });

function makeService(
  options: {
    previousLogoUrl?: string | null;
    removeError?: { message: string } | null;
  } = {},
) {
  const calls: string[] = [];
  const upload = vi.fn(async (path: string) => {
    calls.push(`upload:${path}`);
    return { data: { path }, error: null };
  });
  const remove = vi.fn(async (paths: string[]) => {
    calls.push(`remove:${paths.join(',')}`);
    return { data: [], error: options.removeError ?? null };
  });
  const getPublicUrl = vi.fn((path: string) => ({
    data: { publicUrl: `${STORAGE_BASE}/${path}` },
  }));
  const restaurantsQuery = {
    select: vi.fn(() => restaurantsQuery),
    eq: vi.fn(() => restaurantsQuery),
    maybeSingle: vi.fn(async () => {
      calls.push('read-logo');
      return {
        data: {
          logo_url: options.previousLogoUrl === undefined ? PREVIOUS_URL : options.previousLogoUrl,
        },
        error: null,
      };
    }),
  };
  return {
    calls,
    upload,
    remove,
    client: {
      from: vi.fn(() => restaurantsQuery),
      storage: {
        getBucket: vi
          .fn()
          .mockResolvedValue({ data: { name: 'restaurant-branding' }, error: null }),
        createBucket: vi.fn(),
        from: vi.fn(() => ({ upload, remove, getPublicUrl })),
      },
    },
  };
}

describe('restaurant logo route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiRateLimitMock.mockResolvedValue(null);
    requireAdminMembershipMock.mockResolvedValue({ role: 'owner' });
    getRouteHandlerSupabaseClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
      },
    });
  });

  it('uploads to a new versioned path, saves logo_url, then deletes the previous object', async () => {
    const service = makeService();
    getServiceSupabaseClientMock.mockReturnValue(service.client);
    updateRestaurantMock.mockImplementation(async (_id: string, input: { logoUrl: string }) => {
      service.calls.push('save-logo-url');
      return updatedRestaurant(input.logoUrl);
    });

    const response = await POST(uploadRequest(), context());

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.path).toMatch(new RegExp(`^${RESTAURANT_ID}/logo-[a-z0-9-]+\\.png$`));
    expect(body.url).toBe(`${STORAGE_BASE}/${body.path}`);
    expect(body.restaurant).toMatchObject({ id: RESTAURANT_ID, logoUrl: body.url, role: 'owner' });
    expect(service.upload).toHaveBeenCalledWith(
      body.path,
      expect.anything(),
      expect.objectContaining({ upsert: false, contentType: 'image/png' }),
    );
    expect(updateRestaurantMock).toHaveBeenCalledWith(
      RESTAURANT_ID,
      { logoUrl: body.url },
      service.client,
    );
    // Order: read previous, upload new, save the URL, only then delete the old object.
    expect(service.calls).toEqual([
      'read-logo',
      `upload:${body.path}`,
      'save-logo-url',
      `remove:${RESTAURANT_ID}/logo`,
    ]);
  });

  it('removes the new object and keeps the old one when saving the URL fails', async () => {
    const service = makeService();
    getServiceSupabaseClientMock.mockReturnValue(service.client);
    updateRestaurantMock.mockRejectedValue(new Error('SECRET_DB_DETAIL'));

    const response = await POST(uploadRequest(), context());

    expect(response.status).toBe(500);
    const text = await response.text();
    expect(text).not.toContain('SECRET_DB_DETAIL');
    expect(JSON.parse(text)).toMatchObject({ code: 'INTERNAL_ERROR' });
    const uploadedPath = String(service.upload.mock.calls[0]?.[0]);
    expect(service.remove).toHaveBeenCalledTimes(1);
    expect(service.remove).toHaveBeenCalledWith([uploadedPath]);
  });

  it('logs and still succeeds when the previous object cannot be deleted', async () => {
    const service = makeService({ removeError: { message: 'storage down' } });
    getServiceSupabaseClientMock.mockReturnValue(service.client);
    updateRestaurantMock.mockImplementation(async (_id: string, input: { logoUrl: string }) =>
      updatedRestaurant(input.logoUrl),
    );

    const response = await POST(uploadRequest(), context());

    expect(response.status).toBe(200);
    expect(loggerWarnMock).toHaveBeenCalledWith(
      'ops.restaurants.logo.cleanup_failed',
      expect.objectContaining({ restaurantId: RESTAURANT_ID }),
    );
  });

  it('never deletes an object outside this restaurant folder', async () => {
    const service = makeService({
      previousLogoUrl: `${STORAGE_BASE}/33333333-3333-4333-8333-333333333333/logo`,
    });
    getServiceSupabaseClientMock.mockReturnValue(service.client);
    updateRestaurantMock.mockImplementation(async (_id: string, input: { logoUrl: string }) =>
      updatedRestaurant(input.logoUrl),
    );

    await POST(uploadRequest(), context());

    expect(service.remove).not.toHaveBeenCalled();
  });

  it('rejects unsupported files with a C1 body before touching storage', async () => {
    const response = await POST(uploadRequest('image/svg+xml'), context());

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toMatchObject({ code: 'UNSUPPORTED_FILE' });
    expect(body.error).toBe(body.message);
    expect(getServiceSupabaseClientMock).not.toHaveBeenCalled();
  });

  it('DELETE clears logo_url and then deletes the stored object', async () => {
    const service = makeService();
    getServiceSupabaseClientMock.mockReturnValue(service.client);
    updateRestaurantMock.mockImplementation(async () => {
      service.calls.push('clear-logo-url');
      return updatedRestaurant(null);
    });

    const response = await DELETE(deleteRequest(), context());

    expect(response.status).toBe(200);
    expect((await response.json()).restaurant).toMatchObject({ logoUrl: null });
    expect(updateRestaurantMock).toHaveBeenCalledWith(
      RESTAURANT_ID,
      { logoUrl: null },
      service.client,
    );
    expect(service.calls).toEqual(['read-logo', 'clear-logo-url', `remove:${RESTAURANT_ID}/logo`]);
  });

  it('DELETE requires an admin membership', async () => {
    requireAdminMembershipMock.mockRejectedValue({ code: 'MEMBERSHIP_ROLE_DENIED' });

    const response = await DELETE(deleteRequest(), context());

    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('FORBIDDEN');
    expect(getServiceSupabaseClientMock).not.toHaveBeenCalled();
  });
});
