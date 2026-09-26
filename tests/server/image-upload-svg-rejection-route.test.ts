import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const requireApiRateLimitMock = vi.hoisted(() => vi.fn());
const requireAdminMembershipMock = vi.hoisted(() => vi.fn());

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
  updateRestaurantProfile: vi.fn(async (id: string, input: { logoUrl: string | null }) => ({
    restaurant: { id, logoUrl: input.logoUrl },
    previous: { name: 'The Bell', slug: 'the-bell', logoUrl: null },
  })),
}));

import { POST as postRestaurantLogo } from '@/src/app/api/ops/restaurants/[id]/logo/route';
import { POST as postProfileImage } from '@/src/app/api/profile/image/route';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const RESTAURANT_ID = '22222222-2222-4222-8222-222222222222';

function uploadFile(contentType: string, filename: string): File {
  const file = new File(['<image-bytes>'], filename, { type: contentType });
  // The test environment's File polyfill omits arrayBuffer(); add it so the
  // accept-path can run while keeping `instanceof File` true for the route check.
  Object.defineProperty(file, 'arrayBuffer', {
    value: async () => new TextEncoder().encode('<image-bytes>').buffer,
  });
  return file;
}

function uploadRequest(url: string, contentType: string, filename: string) {
  const formData = new FormData();
  formData.set('file', uploadFile(contentType, filename));
  const request = new NextRequest(url, { method: 'POST' });
  // The test environment's multipart parser cannot decode a serialized FormData
  // body, so provide the parsed form directly. The routes only read the file via
  // req.formData(); this keeps the MIME-type allowlist check under test.
  vi.spyOn(request, 'formData').mockResolvedValue(formData);
  return request;
}

function authenticatedRouteClient() {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: USER_ID, email: 'host@example.com' } },
        error: null,
      }),
    },
  };
}

function serviceClientWithStorage() {
  const restaurantsQuery = {
    select: vi.fn(() => restaurantsQuery),
    eq: vi.fn(() => restaurantsQuery),
    maybeSingle: vi.fn().mockResolvedValue({ data: { logo_url: null }, error: null }),
  };
  return {
    from: vi.fn(() => restaurantsQuery),
    storage: {
      getBucket: vi.fn().mockResolvedValue({ data: { name: 'bucket' }, error: null }),
      createBucket: vi.fn().mockResolvedValue({ data: { name: 'bucket' }, error: null }),
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ data: { path: 'p' }, error: null }),
        remove: vi.fn().mockResolvedValue({ data: [], error: null }),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://cdn.example.com/p' } })),
      })),
    },
  };
}

describe('profile image upload SVG rejection', () => {
  beforeEach(() => {
    getRouteHandlerSupabaseClientMock.mockReset();
    getServiceSupabaseClientMock.mockReset();
    requireApiRateLimitMock.mockReset();

    requireApiRateLimitMock.mockResolvedValue(null);
    getRouteHandlerSupabaseClientMock.mockResolvedValue(authenticatedRouteClient());
    getServiceSupabaseClientMock.mockReturnValue(serviceClientWithStorage());
  });

  it('rejects image/svg+xml avatar uploads', async () => {
    const response = await postProfileImage(
      uploadRequest('https://www.nabatable.com/api/profile/image', 'image/svg+xml', 'avatar.svg'),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('UNSUPPORTED_FILE');
    expect(getServiceSupabaseClientMock).not.toHaveBeenCalled();
  });

  it('still accepts image/png avatar uploads', async () => {
    const response = await postProfileImage(
      uploadRequest('https://www.nabatable.com/api/profile/image', 'image/png', 'avatar.png'),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.path).toBe(`${USER_ID}/avatar`);
  });
});

describe('restaurant logo upload SVG rejection', () => {
  beforeEach(() => {
    getRouteHandlerSupabaseClientMock.mockReset();
    getServiceSupabaseClientMock.mockReset();
    requireApiRateLimitMock.mockReset();
    requireAdminMembershipMock.mockReset();

    requireApiRateLimitMock.mockResolvedValue(null);
    requireAdminMembershipMock.mockResolvedValue({ role: 'owner' });
    getRouteHandlerSupabaseClientMock.mockResolvedValue(authenticatedRouteClient());
    getServiceSupabaseClientMock.mockReturnValue(serviceClientWithStorage());
  });

  it('rejects image/svg+xml logo uploads', async () => {
    const response = await postRestaurantLogo(
      uploadRequest(
        `https://app.nabatable.com/api/ops/restaurants/${RESTAURANT_ID}/logo`,
        'image/svg+xml',
        'logo.svg',
      ),
      { params: Promise.resolve({ id: RESTAURANT_ID }) },
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('UNSUPPORTED_FILE');
    expect(getServiceSupabaseClientMock).not.toHaveBeenCalled();
  });

  it('still accepts image/png logo uploads', async () => {
    const response = await postRestaurantLogo(
      uploadRequest(
        `https://app.nabatable.com/api/ops/restaurants/${RESTAURANT_ID}/logo`,
        'image/png',
        'logo.png',
      ),
      { params: Promise.resolve({ id: RESTAURANT_ID }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.path).toMatch(new RegExp(`^${RESTAURANT_ID}/logo-[a-z0-9-]+\\.png$`));
  });
});
