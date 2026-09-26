import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const requireAdminMembershipMock = vi.hoisted(() => vi.fn());
const requireMembershipForRestaurantMock = vi.hoisted(() => vi.fn());
const invalidateUserMembershipsCacheMock = vi.hoisted(() => vi.fn());
const updateRestaurantMock = vi.hoisted(() => vi.fn());
const getRestaurantBusinessDescriptionMock = vi.hoisted(() => vi.fn());
const upsertRestaurantBusinessDescriptionMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/posthog/server', () => ({
  captureServerException: vi.fn(),
  captureRestaurantServerEvent: vi.fn(),
}));

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: getRouteHandlerSupabaseClientMock,
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

vi.mock('@/server/team/access', () => ({
  requireAdminMembership: requireAdminMembershipMock,
  requireMembershipForRestaurant: requireMembershipForRestaurantMock,
  invalidateUserMembershipsCache: invalidateUserMembershipsCacheMock,
}));

vi.mock('@/server/restaurants', () => ({
  deleteRestaurant: vi.fn(),
  updateRestaurantProfile: updateRestaurantMock,
}));

vi.mock('@/server/restaurants/details', () => ({
  getRestaurantBusinessDescription: getRestaurantBusinessDescriptionMock,
  upsertRestaurantBusinessDescription: upsertRestaurantBusinessDescriptionMock,
}));

vi.mock('@/server/security/csrf', () => ({
  withCsrfProtectedMutation: vi.fn((_req: unknown, handler: () => Promise<Response>) => handler()),
}));

import { RestaurantUpdateError, slugTakenError } from '@/server/restaurants/update-errors';
import { PATCH } from '@/src/app/api/ops/restaurants/[id]/route';

const RESTAURANT_ID = 'rest-1';

const updated = {
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
  logoUrl: null,
  emailSendReminder24h: true,
  emailSendReminderShort: true,
  emailSendReviewRequest: true,
  reservationIntervalMinutes: 15,
  reservationDefaultDurationMinutes: 90,
  reservationLastSeatingBufferMinutes: 15,
  reservationLifecycleGraceMinutes: 15,
  businessDescription: 'Cosy pub',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-09-26T10:00:00.000Z',
};

function patchRequest(body: unknown) {
  return new NextRequest(`https://app.nabatable.com/api/ops/restaurants/${RESTAURANT_ID}`, {
    method: 'PATCH',
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const context = () => ({ params: Promise.resolve({ id: RESTAURANT_ID }) });

function signedIn(user: { id: string } | null = { id: 'user-1' }) {
  getRouteHandlerSupabaseClientMock.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
  });
}

function previousOf(restaurant: { name: string; slug: string; logoUrl: string | null }) {
  return { name: restaurant.name, slug: restaurant.slug, logoUrl: restaurant.logoUrl };
}

describe('PATCH /api/ops/restaurants/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signedIn();
    getServiceSupabaseClientMock.mockReturnValue({ service: true });
    requireAdminMembershipMock.mockResolvedValue({ role: 'owner' });
    updateRestaurantMock.mockResolvedValue({ restaurant: updated, previous: previousOf(updated) });
  });

  it('returns 409 SLUG_TAKEN with a slug field when the link is used elsewhere', async () => {
    updateRestaurantMock.mockRejectedValue(slugTakenError());

    const response = await PATCH(patchRequest({ slug: 'the-crown' }), context());

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body).toMatchObject({ code: 'SLUG_TAKEN', fields: { slug: [expect.any(String)] } });
    expect(body.message).toBe(body.error);
    expect(invalidateUserMembershipsCacheMock).not.toHaveBeenCalled();
  });

  it('maps server-side field validation to 400 VALIDATION_FAILED with fields', async () => {
    updateRestaurantMock.mockRejectedValue(
      new RestaurantUpdateError('VALIDATION_FAILED', 'Add a manager alert number.', {
        managerNotificationPhone: ['Add a manager alert number.'],
      }),
    );

    const response = await PATCH(patchRequest({ managerWhatsappEnabled: true }), context());

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      code: 'VALIDATION_FAILED',
      fields: { managerNotificationPhone: ['Add a manager alert number.'] },
    });
  });

  it('returns C1 field errors for an invalid body', async () => {
    const response = await PATCH(patchRequest({ slug: 'Not A Slug!' }), context());

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(body.fields.slug).toEqual([expect.any(String)]);
    expect(updateRestaurantMock).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON with a stable code', async () => {
    const response = await PATCH(patchRequest('{not json'), context());

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('INVALID_JSON');
  });

  it('saves the business description in the same update call (no second write)', async () => {
    const response = await PATCH(
      patchRequest({ name: 'The Bell', businessDescription: 'Cosy pub' }),
      context(),
    );

    expect(response.status).toBe(200);
    expect(updateRestaurantMock).toHaveBeenCalledTimes(1);
    expect(updateRestaurantMock).toHaveBeenCalledWith(
      RESTAURANT_ID,
      expect.objectContaining({
        name: 'The Bell',
        businessDescription: 'Cosy pub',
        managerWhatsappConsentActorId: 'user-1',
      }),
      { service: true },
    );
    expect(upsertRestaurantBusinessDescriptionMock).not.toHaveBeenCalled();
    expect(getRestaurantBusinessDescriptionMock).not.toHaveBeenCalled();
    const body = await response.json();
    expect(body.restaurant).toMatchObject({ businessDescription: 'Cosy pub', role: 'owner' });
  });

  it('drops the cached memberships only when the stored name or slug actually changed', async () => {
    updateRestaurantMock.mockResolvedValueOnce({
      restaurant: updated,
      previous: { ...previousOf(updated), name: 'The Old Bell' },
    });
    await PATCH(patchRequest({ name: 'The Bell' }), context());
    expect(invalidateUserMembershipsCacheMock).toHaveBeenCalledWith('user-1');

    invalidateUserMembershipsCacheMock.mockClear();
    updateRestaurantMock.mockResolvedValueOnce({
      restaurant: updated,
      previous: { ...previousOf(updated), slug: 'the-old-bell' },
    });
    await PATCH(patchRequest({ slug: 'the-bell' }), context());
    expect(invalidateUserMembershipsCacheMock).toHaveBeenCalledWith('user-1');

    invalidateUserMembershipsCacheMock.mockClear();
    await PATCH(patchRequest({ managerName: 'Alex' }), context());
    expect(invalidateUserMembershipsCacheMock).not.toHaveBeenCalled();
  });

  it('keeps the membership cache when a full public-details save resends an unchanged name and slug', async () => {
    const response = await PATCH(
      patchRequest({ name: 'The Bell', slug: 'the-bell', address: '1 High Street' }),
      context(),
    );

    expect(response.status).toBe(200);
    expect(invalidateUserMembershipsCacheMock).not.toHaveBeenCalled();
  });

  it('returns 404 when the restaurant disappears mid-save', async () => {
    updateRestaurantMock.mockRejectedValue(
      new RestaurantUpdateError('RESTAURANT_NOT_FOUND', 'Restaurant not found.'),
    );

    const response = await PATCH(patchRequest({ name: 'The Bell' }), context());

    expect(response.status).toBe(404);
    expect((await response.json()).code).toBe('RESTAURANT_NOT_FOUND');
  });

  it('uses C1 bodies for auth and membership failures', async () => {
    signedIn(null);
    const unauthenticated = await PATCH(patchRequest({ name: 'x' }), context());
    expect(unauthenticated.status).toBe(401);
    expect(await unauthenticated.json()).toMatchObject({ code: 'UNAUTHENTICATED' });

    signedIn();
    requireAdminMembershipMock.mockRejectedValue({ code: 'MEMBERSHIP_ROLE_DENIED' });
    const denied = await PATCH(patchRequest({ name: 'x' }), context());
    expect(denied.status).toBe(403);
    expect(await denied.json()).toMatchObject({ code: 'FORBIDDEN' });
  });
});
