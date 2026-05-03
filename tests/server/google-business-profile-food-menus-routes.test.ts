import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ensureRestaurantAdminAccessMock = vi.hoisted(() => vi.fn());
const resolveRestaurantIdMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const listPendingFoodMenusImportReviewsMock = vi.hoisted(() => vi.fn());
const prepareFoodMenusProjectionMock = vi.hoisted(() => vi.fn());
const prepareFoodMenusImportReviewMock = vi.hoisted(() => vi.fn());
const decideFoodMenusImportReviewMock = vi.hoisted(() => vi.fn());
const publishFoodMenusProjectionToGoogleMock = vi.hoisted(() => vi.fn());
const refreshFoodMenusImportReviewFromGoogleMock = vi.hoisted(() => vi.fn());
const getGoogleBusinessProfileFoodMenusContextMock = vi.hoisted(() => vi.fn());

vi.mock('@/app/api/ops/restaurants/[id]/_shared', () => ({
  ensureRestaurantAdminAccess: ensureRestaurantAdminAccessMock,
  resolveRestaurantId: resolveRestaurantIdMock,
}));

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

vi.mock('@/server/google-business-profile/food-menus-storage', () => ({
  listPendingFoodMenusImportReviews: listPendingFoodMenusImportReviewsMock,
}));

vi.mock('@/server/google-business-profile/food-menus-sync', () => ({
  decideFoodMenusImportReview: decideFoodMenusImportReviewMock,
  prepareFoodMenusProjection: prepareFoodMenusProjectionMock,
  prepareFoodMenusImportReview: prepareFoodMenusImportReviewMock,
  publishFoodMenusProjectionToGoogle: publishFoodMenusProjectionToGoogleMock,
  refreshFoodMenusImportReviewFromGoogle: refreshFoodMenusImportReviewFromGoogleMock,
}));

vi.mock('@/server/google-business-profile/service', () => ({
  getGoogleBusinessProfileFoodMenusContext: getGoogleBusinessProfileFoodMenusContextMock,
}));

import { POST as decisionPOST } from '@/src/app/api/ops/restaurants/[id]/google-business-profile/food-menus/import-review/[reviewId]/decision/route';
import { POST as importReviewRefreshPOST } from '@/src/app/api/ops/restaurants/[id]/google-business-profile/food-menus/import-review/refresh/route';
import {
  GET as importReviewGET,
  POST as importReviewPOST,
} from '@/src/app/api/ops/restaurants/[id]/google-business-profile/food-menus/import-review/route';
import { POST as projectionPOST } from '@/src/app/api/ops/restaurants/[id]/google-business-profile/food-menus/projection/route';
import { POST as publishPOST } from '@/src/app/api/ops/restaurants/[id]/google-business-profile/food-menus/publish/route';

const serviceClient = { from: vi.fn() };

const googleFoodMenus = {
  name: 'accounts/123/locations/456/foodMenus',
  menus: [
    {
      labels: [{ displayName: 'Dinner menu', languageCode: 'en-GB' }],
      sections: [
        {
          labels: [{ displayName: 'Starters', languageCode: 'en-GB' }],
          items: [
            {
              labels: [{ displayName: 'Chilli Paneer', languageCode: 'en-GB' }],
              attributes: { price: { currencyCode: 'GBP', units: '9', nanos: 0 } },
            },
          ],
        },
      ],
    },
  ],
};

describe('GBP FoodMenus routes', () => {
  beforeEach(() => {
    ensureRestaurantAdminAccessMock.mockReset();
    resolveRestaurantIdMock.mockReset();
    getServiceSupabaseClientMock.mockReset();
    listPendingFoodMenusImportReviewsMock.mockReset();
    prepareFoodMenusProjectionMock.mockReset();
    prepareFoodMenusImportReviewMock.mockReset();
    decideFoodMenusImportReviewMock.mockReset();
    publishFoodMenusProjectionToGoogleMock.mockReset();
    refreshFoodMenusImportReviewFromGoogleMock.mockReset();
    getGoogleBusinessProfileFoodMenusContextMock.mockReset();
    resolveRestaurantIdMock.mockResolvedValue('rest-1');
    ensureRestaurantAdminAccessMock.mockResolvedValue({
      userId: 'user-1',
      userEmail: 'ops@example.com',
    });
    getServiceSupabaseClientMock.mockReturnValue(serviceClient);
    listPendingFoodMenusImportReviewsMock.mockResolvedValue([]);
    getGoogleBusinessProfileFoodMenusContextMock.mockResolvedValue({
      externalProfileId: 'profile-1',
      accessToken: 'access-token',
      foodMenusName: 'accounts/123/locations/456/foodMenus',
      canHaveFoodMenus: true,
    });
  });

  it('returns the shared auth response for projection preparation', async () => {
    ensureRestaurantAdminAccessMock.mockResolvedValue(
      NextResponse.json({ error: 'Authentication required' }, { status: 401 }),
    );

    const response = await projectionPOST(
      new NextRequest(
        'https://example.com/api/ops/restaurants/rest-1/google-business-profile/food-menus/projection',
        {
          method: 'POST',
          body: JSON.stringify({ foodMenusName: 'accounts/123/locations/456/foodMenus' }),
        },
      ),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(401);
    expect(prepareFoodMenusProjectionMock).not.toHaveBeenCalled();
  });

  it('validates projection payloads before calling the service', async () => {
    const response = await projectionPOST(
      new NextRequest(
        'https://example.com/api/ops/restaurants/rest-1/google-business-profile/food-menus/projection',
        {
          method: 'POST',
          body: JSON.stringify({ foodMenusName: '', sourceUrl: 'not-a-url' }),
        },
      ),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(400);
    expect(prepareFoodMenusProjectionMock).not.toHaveBeenCalled();
  });

  it('prepares a Nabatable projection through the service layer', async () => {
    prepareFoodMenusProjectionMock.mockResolvedValue({
      localItemCount: 2,
      projectionHash: 'a'.repeat(64),
      projection: { foodMenus: googleFoodMenus, identities: [], skippedItems: [] },
      snapshot: { id: 'snapshot-1' },
      identities: [{ id: 'identity-1' }],
    });

    const response = await projectionPOST(
      new NextRequest(
        'https://example.com/api/ops/restaurants/rest-1/google-business-profile/food-menus/projection',
        {
          method: 'POST',
          body: JSON.stringify({
            foodMenusName: 'accounts/123/locations/456/foodMenus',
            menuLabel: 'Dinner menu',
            sourceUrl: 'https://example.com/menu',
            cuisines: ['INDIAN'],
            persist: true,
          }),
        },
      ),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(200);
    expect(prepareFoodMenusProjectionMock).toHaveBeenCalledWith({
      client: serviceClient,
      restaurantId: 'rest-1',
      foodMenusName: 'accounts/123/locations/456/foodMenus',
      menuLabel: 'Dinner menu',
      sourceUrl: 'https://example.com/menu',
      languageCode: undefined,
      includeUnavailable: undefined,
      cuisines: ['INDIAN'],
      createdByUserId: 'user-1',
      persist: true,
    });
    await expect(response.json()).resolves.toMatchObject({
      localItemCount: 2,
      projectionHash: 'a'.repeat(64),
      persisted: true,
    });
  });

  it('validates import-review Google FoodMenus payloads before calling the service', async () => {
    const response = await importReviewPOST(
      new NextRequest(
        'https://example.com/api/ops/restaurants/rest-1/google-business-profile/food-menus/import-review',
        {
          method: 'POST',
          body: JSON.stringify({
            googleFoodMenus: {
              name: 'accounts/123/locations/456/foodMenus',
              menus: [{ labels: [], sections: [{ labels: [], items: [{ labels: [] }] }] }],
            },
          }),
        },
      ),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(400);
    expect(prepareFoodMenusImportReviewMock).not.toHaveBeenCalled();
  });

  it('lists pending FoodMenus import-review rows for operator review', async () => {
    listPendingFoodMenusImportReviewsMock.mockResolvedValue([
      {
        id: 'review-1',
        googleItemName: 'Chilli Paneer',
        decisionStatus: 'pending',
      },
    ]);

    const response = await importReviewGET(
      new NextRequest(
        'https://example.com/api/ops/restaurants/rest-1/google-business-profile/food-menus/import-review',
        { method: 'GET' },
      ),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(200);
    expect(listPendingFoodMenusImportReviewsMock).toHaveBeenCalledWith({
      client: serviceClient,
      restaurantId: 'rest-1',
    });
    await expect(response.json()).resolves.toMatchObject({
      pendingCount: 1,
      rows: [{ id: 'review-1', decisionStatus: 'pending' }],
    });
  });

  it('prepares a non-mutating import review through the service layer', async () => {
    prepareFoodMenusImportReviewMock.mockResolvedValue({
      localItemCount: 1,
      previousIdentityCount: 1,
      projectionSnapshotId: '11111111-1111-4111-8111-111111111111',
      googleSnapshot: { id: 'google-snapshot-1' },
      review: { items: [], localItemsMissingFromGoogle: [] },
      rows: [{ id: 'review-1' }],
    });

    const response = await importReviewPOST(
      new NextRequest(
        'https://example.com/api/ops/restaurants/rest-1/google-business-profile/food-menus/import-review',
        {
          method: 'POST',
          body: JSON.stringify({
            googleFoodMenus,
            projectionSnapshotId: '11111111-1111-4111-8111-111111111111',
            persist: true,
          }),
        },
      ),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(200);
    expect(prepareFoodMenusImportReviewMock).toHaveBeenCalledWith({
      client: serviceClient,
      restaurantId: 'rest-1',
      googleFoodMenus,
      googleSnapshotId: undefined,
      projectionSnapshotId: '11111111-1111-4111-8111-111111111111',
      createdByUserId: 'user-1',
      persist: true,
    });
    await expect(response.json()).resolves.toMatchObject({
      localItemCount: 1,
      previousIdentityCount: 1,
      persisted: true,
    });
  });

  it('refreshes Google FoodMenus server-side before preparing an import review', async () => {
    refreshFoodMenusImportReviewFromGoogleMock.mockResolvedValue({
      googleFoodMenus,
      googleFoodMenusHash: 'a'.repeat(64),
      importReview: {
        localItemCount: 1,
        previousIdentityCount: 1,
        projectionSnapshotId: '11111111-1111-4111-8111-111111111111',
        googleSnapshot: { id: 'google-snapshot-1' },
        review: { items: [], localItemsMissingFromGoogle: [] },
        rows: [{ id: 'review-1' }],
      },
    });

    const response = await importReviewRefreshPOST(
      new NextRequest(
        'https://example.com/api/ops/restaurants/rest-1/google-business-profile/food-menus/import-review/refresh',
        {
          method: 'POST',
          body: JSON.stringify({
            projectionSnapshotId: '11111111-1111-4111-8111-111111111111',
            persist: true,
          }),
        },
      ),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(200);
    expect(getGoogleBusinessProfileFoodMenusContextMock).toHaveBeenCalledWith({
      client: serviceClient,
      restaurantId: 'rest-1',
    });
    expect(refreshFoodMenusImportReviewFromGoogleMock).toHaveBeenCalledWith({
      client: serviceClient,
      restaurantId: 'rest-1',
      accessToken: 'access-token',
      foodMenusName: 'accounts/123/locations/456/foodMenus',
      externalProfileId: 'profile-1',
      projectionSnapshotId: '11111111-1111-4111-8111-111111111111',
      createdByUserId: 'user-1',
      persist: true,
    });
    await expect(response.json()).resolves.toMatchObject({
      googleFoodMenusHash: 'a'.repeat(64),
      canHaveFoodMenus: true,
      localItemCount: 1,
      previousIdentityCount: 1,
      persisted: true,
    });
  });

  it('validates Google FoodMenus refresh import-review payloads', async () => {
    const response = await importReviewRefreshPOST(
      new NextRequest(
        'https://example.com/api/ops/restaurants/rest-1/google-business-profile/food-menus/import-review/refresh',
        {
          method: 'POST',
          body: JSON.stringify({ projectionSnapshotId: 'not-a-uuid' }),
        },
      ),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(400);
    expect(refreshFoodMenusImportReviewFromGoogleMock).not.toHaveBeenCalled();
  });

  it('validates import-review decision payloads before calling the service', async () => {
    const response = await decisionPOST(
      new NextRequest(
        'https://example.com/api/ops/restaurants/rest-1/google-business-profile/food-menus/import-review/review-1/decision',
        {
          method: 'POST',
          body: JSON.stringify({ action: 'delete_local_item' }),
        },
      ),
      { params: Promise.resolve({ id: 'rest-1', reviewId: 'review-1' }) },
    );

    expect(response.status).toBe(400);
    expect(decideFoodMenusImportReviewMock).not.toHaveBeenCalled();
  });

  it('applies an explicit import-review decision through the service layer', async () => {
    decideFoodMenusImportReviewMock.mockResolvedValue({
      review: {
        id: 'review-1',
        decisionStatus: 'applied',
        decisionAction: 'apply_to_nabatable',
      },
      item: { id: 'item-1', itemName: 'Chilli Paneer' },
    });

    const response = await decisionPOST(
      new NextRequest(
        'https://example.com/api/ops/restaurants/rest-1/google-business-profile/food-menus/import-review/review-1/decision',
        {
          method: 'POST',
          body: JSON.stringify({ action: 'apply_to_nabatable' }),
        },
      ),
      { params: Promise.resolve({ id: 'rest-1', reviewId: 'review-1' }) },
    );

    expect(response.status).toBe(200);
    expect(decideFoodMenusImportReviewMock).toHaveBeenCalledWith({
      client: serviceClient,
      restaurantId: 'rest-1',
      reviewId: 'review-1',
      action: 'apply_to_nabatable',
      decidedByUserId: 'user-1',
    });
    await expect(response.json()).resolves.toMatchObject({
      review: { decisionStatus: 'applied' },
      item: { id: 'item-1' },
    });
  });

  it('publishes FoodMenus through stored OAuth context and preflighted service layer', async () => {
    publishFoodMenusProjectionToGoogleMock.mockResolvedValue({
      projection: { projectionHash: 'a'.repeat(64) },
      baselineGoogleHash: 'b'.repeat(64),
      baselineGoogleSnapshot: { id: 'baseline-snapshot-1' },
      attempt: { id: 'attempt-1', status: 'succeeded' },
      googleResponse: googleFoodMenus,
    });

    const response = await publishPOST(
      new NextRequest(
        'https://example.com/api/ops/restaurants/rest-1/google-business-profile/food-menus/publish',
        {
          method: 'POST',
          body: JSON.stringify({
            menuLabel: 'Dinner menu',
            sourceUrl: 'https://example.com/menu',
            cuisines: ['INDIAN'],
            expectedGoogleHash: 'b'.repeat(64),
            expectedProjectionHash: 'a'.repeat(64),
          }),
        },
      ),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(200);
    expect(getGoogleBusinessProfileFoodMenusContextMock).toHaveBeenCalledWith({
      client: serviceClient,
      restaurantId: 'rest-1',
      requirePushEnabled: true,
    });
    expect(publishFoodMenusProjectionToGoogleMock).toHaveBeenCalledWith({
      client: serviceClient,
      restaurantId: 'rest-1',
      accessToken: 'access-token',
      foodMenusName: 'accounts/123/locations/456/foodMenus',
      menuLabel: 'Dinner menu',
      sourceUrl: 'https://example.com/menu',
      languageCode: undefined,
      includeUnavailable: undefined,
      cuisines: ['INDIAN'],
      externalProfileId: 'profile-1',
      createdByUserId: 'user-1',
      expectedGoogleHash: 'b'.repeat(64),
      expectedProjectionHash: 'a'.repeat(64),
    });
    await expect(response.json()).resolves.toMatchObject({
      projectionHash: 'a'.repeat(64),
      baselineGoogleHash: 'b'.repeat(64),
      canHaveFoodMenus: true,
      attempt: { status: 'succeeded' },
    });
  });

  it('returns conflict when FoodMenus publish preflight detects a changed baseline', async () => {
    const error = new Error('Google FoodMenus changed since the expected baseline.');
    error.name = 'GBP_FOOD_MENUS_PREFLIGHT_CHANGED';
    publishFoodMenusProjectionToGoogleMock.mockRejectedValue(
      Object.assign(error, {
        baselineGoogleHash: 'c'.repeat(64),
        expectedGoogleHash: 'b'.repeat(64),
        attempt: { id: 'attempt-1', status: 'preflight_failed' },
      }),
    );

    const response = await publishPOST(
      new NextRequest(
        'https://example.com/api/ops/restaurants/rest-1/google-business-profile/food-menus/publish',
        {
          method: 'POST',
          body: JSON.stringify({ expectedGoogleHash: 'b'.repeat(64) }),
        },
      ),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: 'GBP_FOOD_MENUS_PREFLIGHT_CHANGED',
      baselineGoogleHash: 'c'.repeat(64),
      expectedGoogleHash: 'b'.repeat(64),
      canHaveFoodMenus: true,
      attempt: { status: 'preflight_failed' },
    });
  });

  it('returns conflict when FoodMenus publish preflight detects a changed projection', async () => {
    const error = new Error('Nabatable FoodMenus projection changed since the expected baseline.');
    error.name = 'GBP_FOOD_MENUS_PROJECTION_CHANGED';
    publishFoodMenusProjectionToGoogleMock.mockRejectedValue(
      Object.assign(error, {
        projectionHash: 'd'.repeat(64),
        expectedProjectionHash: 'a'.repeat(64),
        baselineGoogleHash: 'b'.repeat(64),
        attempt: { id: 'attempt-1', status: 'preflight_failed' },
      }),
    );

    const response = await publishPOST(
      new NextRequest(
        'https://example.com/api/ops/restaurants/rest-1/google-business-profile/food-menus/publish',
        {
          method: 'POST',
          body: JSON.stringify({
            expectedGoogleHash: 'b'.repeat(64),
            expectedProjectionHash: 'a'.repeat(64),
          }),
        },
      ),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: 'GBP_FOOD_MENUS_PROJECTION_CHANGED',
      baselineGoogleHash: 'b'.repeat(64),
      projectionHash: 'd'.repeat(64),
      expectedProjectionHash: 'a'.repeat(64),
      canHaveFoodMenus: true,
      attempt: { status: 'preflight_failed' },
    });
  });
});
