import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ensureRestaurantAdminAccessMock = vi.hoisted(() => vi.fn());
const resolveRestaurantIdMock = vi.hoisted(() => vi.fn());
const listOutboundCandidatesMock = vi.hoisted(() => vi.fn());
const cancelOutboundCandidateMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock('@/app/api/ops/restaurants/[id]/_shared', () => ({
  ensureRestaurantAdminAccess: ensureRestaurantAdminAccessMock,
  resolveRestaurantId: resolveRestaurantIdMock,
}));

vi.mock('@/server/dual-sync/outbound', () => ({
  listOutboundCandidates: listOutboundCandidatesMock,
  cancelOutboundCandidate: cancelOutboundCandidateMock,
}));

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

import { POST as cancelPOST } from '@/src/app/api/ops/restaurants/[id]/dual-sync/candidates/[candidateId]/cancel/route';
import { GET as listGET } from '@/src/app/api/ops/restaurants/[id]/dual-sync/candidates/route';

const serviceClient = { from: vi.fn() };
const routeContext = { params: Promise.resolve({ id: 'rest-1' }) };

describe('dual-sync candidates routes', () => {
  beforeEach(() => {
    ensureRestaurantAdminAccessMock.mockReset();
    resolveRestaurantIdMock.mockReset();
    listOutboundCandidatesMock.mockReset();
    cancelOutboundCandidateMock.mockReset();
    getServiceSupabaseClientMock.mockReset();

    resolveRestaurantIdMock.mockResolvedValue('rest-1');
    ensureRestaurantAdminAccessMock.mockResolvedValue({ userId: 'user-1' });
    getServiceSupabaseClientMock.mockReturnValue(serviceClient);
    listOutboundCandidatesMock.mockResolvedValue([
      {
        id: 'cand-1',
        restaurantId: 'rest-1',
        fieldKey: 'profile.name',
        status: 'open',
      },
    ]);
    cancelOutboundCandidateMock.mockResolvedValue({
      id: 'cand-1',
      restaurantId: 'rest-1',
      fieldKey: 'profile.name',
      status: 'cancelled',
    });
  });

  it('lists scoped candidates with status and limit filters', async () => {
    const response = await listGET(
      new NextRequest(
        'https://example.com/api/ops/restaurants/rest-1/dual-sync/candidates?status=open,cancelled,unknown&limit=250',
      ),
      routeContext,
    );

    expect(response.status).toBe(200);
    expect(listOutboundCandidatesMock).toHaveBeenCalledWith({
      client: serviceClient,
      restaurantId: 'rest-1',
      limit: 250,
      statuses: ['open', 'cancelled'],
    });
    await expect(response.json()).resolves.toMatchObject({
      restaurantId: 'rest-1',
      candidates: [{ id: 'cand-1', status: 'open' }],
    });
  });

  it('defaults candidate listing to open rows', async () => {
    const response = await listGET(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/dual-sync/candidates'),
      routeContext,
    );

    expect(response.status).toBe(200);
    expect(listOutboundCandidatesMock).toHaveBeenCalledWith(
      expect.objectContaining({ statuses: ['open'] }),
    );
  });

  it('preserves access checks before candidate reads', async () => {
    ensureRestaurantAdminAccessMock.mockResolvedValue(
      NextResponse.json({ message: 'Forbidden', error: 'Forbidden' }, { status: 403 }),
    );

    const response = await listGET(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/dual-sync/candidates'),
      routeContext,
    );

    expect(response.status).toBe(403);
    expect(listOutboundCandidatesMock).not.toHaveBeenCalled();
  });

  it('cancels an open candidate for the scoped restaurant', async () => {
    const response = await cancelPOST(
      new NextRequest(
        'https://example.com/api/ops/restaurants/rest-1/dual-sync/candidates/cand-1/cancel',
        { method: 'POST' },
      ),
      { params: Promise.resolve({ id: 'rest-1', candidateId: 'cand-1' }) },
    );

    expect(response.status).toBe(200);
    expect(cancelOutboundCandidateMock).toHaveBeenCalledWith({
      client: serviceClient,
      restaurantId: 'rest-1',
      candidateId: 'cand-1',
    });
    await expect(response.json()).resolves.toMatchObject({
      restaurantId: 'rest-1',
      candidate: { id: 'cand-1', status: 'cancelled' },
    });
  });

  it('returns 404 when the candidate is not cancellable for the restaurant', async () => {
    cancelOutboundCandidateMock.mockResolvedValueOnce(null);

    const response = await cancelPOST(
      new NextRequest(
        'https://example.com/api/ops/restaurants/rest-1/dual-sync/candidates/cand-1/cancel',
        { method: 'POST' },
      ),
      { params: Promise.resolve({ id: 'rest-1', candidateId: 'cand-1' }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      code: 'DUAL_SYNC_CANDIDATE_NOT_CANCELLABLE',
    });
  });

  it('preserves access checks before candidate cancellation', async () => {
    ensureRestaurantAdminAccessMock.mockResolvedValue(
      NextResponse.json({ message: 'Forbidden', error: 'Forbidden' }, { status: 403 }),
    );

    const response = await cancelPOST(
      new NextRequest(
        'https://example.com/api/ops/restaurants/rest-1/dual-sync/candidates/cand-1/cancel',
        { method: 'POST' },
      ),
      { params: Promise.resolve({ id: 'rest-1', candidateId: 'cand-1' }) },
    );

    expect(response.status).toBe(403);
    expect(cancelOutboundCandidateMock).not.toHaveBeenCalled();
  });
});
