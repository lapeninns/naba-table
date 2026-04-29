import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ensureRestaurantAdminAccessMock = vi.hoisted(() => vi.fn());
const resolveRestaurantIdMock = vi.hoisted(() => vi.fn());
const composeDraftMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock('@/app/api/ops/restaurants/[id]/_shared', () => ({
  ensureRestaurantAdminAccess: ensureRestaurantAdminAccessMock,
  resolveRestaurantId: resolveRestaurantIdMock,
}));

vi.mock('@/server/google-business-profile-v2/drafts/composer', () => ({
  composeDraft: composeDraftMock,
}));

vi.mock('@/server/google-business-profile-v2/flag', () => ({
  isGbpSyncV2Enabled: () => true,
}));

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

import { POST as createDraftPOST } from '@/src/app/api/ops/restaurants/[id]/google-business-profile/v2/drafts/route';

import type { SyncV2Draft } from '@/server/google-business-profile-v2/types';

const draft: SyncV2Draft = {
  id: 'draft-1',
  workflowId: 'workflow-1',
  restaurantId: 'restaurant-1',
  status: 'open',
  nabatableSnapshot: { sections: [], hash: 'nab-hash', fetchedAt: '2026-04-29T11:15:29.877Z' },
  googleSnapshot: { sections: [], hash: 'google-hash', fetchedAt: '2026-04-29T11:15:29.877Z' },
  diffItems: [],
  fetchedAt: '2026-04-29T11:15:29.877Z',
  createdByUserId: 'user-1',
  createdAt: '2026-04-29T11:15:29.877Z',
  updatedAt: '2026-04-29T11:15:29.877Z',
};

describe('GBP sync V2 draft routes', () => {
  beforeEach(() => {
    ensureRestaurantAdminAccessMock.mockReset();
    resolveRestaurantIdMock.mockReset();
    composeDraftMock.mockReset();
    getServiceSupabaseClientMock.mockReset();
  });

  it('returns the shared auth response before composing a draft', async () => {
    resolveRestaurantIdMock.mockResolvedValue('restaurant-1');
    ensureRestaurantAdminAccessMock.mockResolvedValue(
      NextResponse.json({ error: 'Authentication required' }, { status: 401 }),
    );

    const response = await createDraftPOST(
      new NextRequest(
        'https://example.com/api/ops/restaurants/restaurant-1/google-business-profile/v2/drafts',
        { method: 'POST' },
      ),
      { params: Promise.resolve({ id: 'restaurant-1' }) },
    );

    expect(response.status).toBe(401);
    expect(composeDraftMock).not.toHaveBeenCalled();
  });

  it('creates or resumes a draft with the authenticated actor id', async () => {
    const serviceClient = { from: vi.fn() };
    resolveRestaurantIdMock.mockResolvedValue('restaurant-1');
    ensureRestaurantAdminAccessMock.mockResolvedValue({
      userId: 'user-1',
      userEmail: 'ops@example.com',
    });
    getServiceSupabaseClientMock.mockReturnValue(serviceClient);
    composeDraftMock.mockResolvedValue(draft);

    const response = await createDraftPOST(
      new NextRequest(
        'https://example.com/api/ops/restaurants/restaurant-1/google-business-profile/v2/drafts',
        { method: 'POST' },
      ),
      { params: Promise.resolve({ id: 'restaurant-1' }) },
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ draft });
    expect(composeDraftMock).toHaveBeenCalledWith({
      client: serviceClient,
      restaurantId: 'restaurant-1',
      createdByUserId: 'user-1',
      refresh: false,
    });
  });

  it('passes refresh requests through to the composer', async () => {
    const serviceClient = { from: vi.fn() };
    resolveRestaurantIdMock.mockResolvedValue('restaurant-1');
    ensureRestaurantAdminAccessMock.mockResolvedValue({
      userId: 'user-1',
      userEmail: 'ops@example.com',
    });
    getServiceSupabaseClientMock.mockReturnValue(serviceClient);
    composeDraftMock.mockResolvedValue({ ...draft, id: 'draft-2' });

    const response = await createDraftPOST(
      new NextRequest(
        'https://example.com/api/ops/restaurants/restaurant-1/google-business-profile/v2/drafts',
        {
          method: 'POST',
          body: JSON.stringify({ refresh: true }),
        },
      ),
      { params: Promise.resolve({ id: 'restaurant-1' }) },
    );

    expect(response.status).toBe(201);
    expect(composeDraftMock).toHaveBeenCalledWith({
      client: serviceClient,
      restaurantId: 'restaurant-1',
      createdByUserId: 'user-1',
      refresh: true,
    });
  });

  it('returns conflict instead of a 500 when a locked draft cannot be refreshed', async () => {
    const serviceClient = { from: vi.fn() };
    const error = new Error('This V2 draft is already in progress and cannot be refreshed.');
    error.name = 'GBP_SYNC_V2_DRAFT_REFRESH_CONFLICT';
    resolveRestaurantIdMock.mockResolvedValue('restaurant-1');
    ensureRestaurantAdminAccessMock.mockResolvedValue({
      userId: 'user-1',
      userEmail: 'ops@example.com',
    });
    getServiceSupabaseClientMock.mockReturnValue(serviceClient);
    composeDraftMock.mockRejectedValue(error);

    const response = await createDraftPOST(
      new NextRequest(
        'https://example.com/api/ops/restaurants/restaurant-1/google-business-profile/v2/drafts',
        {
          method: 'POST',
          body: JSON.stringify({ refresh: true }),
        },
      ),
      { params: Promise.resolve({ id: 'restaurant-1' }) },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: 'GBP_SYNC_V2_DRAFT_REFRESH_CONFLICT',
      error: 'This V2 draft is already in progress and cannot be refreshed.',
    });
  });
});
