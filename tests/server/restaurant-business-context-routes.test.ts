import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ensureRestaurantAdminAccessMock = vi.hoisted(() => vi.fn());
const resolveRestaurantIdMock = vi.hoisted(() => vi.fn());
const getRestaurantBusinessContextMock = vi.hoisted(() => vi.fn());
const updateRestaurantBusinessContextMock = vi.hoisted(() => vi.fn());

vi.mock('@/app/api/ops/restaurants/[id]/_shared', () => ({
  ensureRestaurantAdminAccess: ensureRestaurantAdminAccessMock,
  resolveRestaurantId: resolveRestaurantIdMock,
}));

vi.mock('@/server/restaurants/businessContext', () => ({
  getRestaurantBusinessContext: getRestaurantBusinessContextMock,
  updateRestaurantBusinessContext: updateRestaurantBusinessContextMock,
}));

import { GET, PUT } from '@/src/app/api/ops/restaurants/[id]/business-context/route';

describe('restaurant business-context routes', () => {
  beforeEach(() => {
    ensureRestaurantAdminAccessMock.mockReset();
    resolveRestaurantIdMock.mockReset();
    getRestaurantBusinessContextMock.mockReset();
    updateRestaurantBusinessContextMock.mockReset();
  });

  it('returns the canonical business-context snapshot for admins', async () => {
    resolveRestaurantIdMock.mockResolvedValue('rest-1');
    ensureRestaurantAdminAccessMock.mockResolvedValue({ userId: 'user-1' });
    getRestaurantBusinessContextMock.mockResolvedValue({
      core: {
        categories: [],
        serviceAreas: [],
        attributes: [],
        serviceItems: [],
      },
      providerSnapshot: {
        categories: [
          {
            id: 'gbp-category-1',
            displayName: 'Restaurant',
            categoryCode: 'restaurant',
            moreHoursTypes: [],
            isPrimary: true,
            source: 'gbp',
            managedBy: 'gbp',
            updatedAt: '2026-04-18T12:00:00.000Z',
          },
        ],
        serviceAreas: [],
        attributes: [],
        serviceItems: [],
      },
    });

    const response = await GET(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/business-context'),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.providerSnapshot.categories[0].displayName).toBe('Restaurant');
    expect(getRestaurantBusinessContextMock).toHaveBeenCalledWith('rest-1');
  });

  it('rejects empty update payloads', async () => {
    resolveRestaurantIdMock.mockResolvedValue('rest-1');
    ensureRestaurantAdminAccessMock.mockResolvedValue({ userId: 'user-1' });

    const response = await PUT(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/business-context', {
        method: 'PUT',
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(400);
    expect(updateRestaurantBusinessContextMock).not.toHaveBeenCalled();
  });

  it('accepts provider-safe service-area and attribute payload fields', async () => {
    resolveRestaurantIdMock.mockResolvedValue('rest-1');
    ensureRestaurantAdminAccessMock.mockResolvedValue({ userId: 'user-1' });
    updateRestaurantBusinessContextMock.mockResolvedValue({
      core: {
        categories: [],
        serviceAreas: [],
        attributes: [],
        serviceItems: [],
      },
      providerSnapshot: {
        categories: [],
        serviceAreas: [],
        attributes: [],
        serviceItems: [],
      },
    });

    const body = {
      serviceAreas: [
        {
          displayName: 'Cambridge',
          areaType: 'region',
          regionCode: 'GB',
          googlePlaceId: 'ChIJLQEq84ld2EcRIT1eo-Ego2M',
          googlePlaceResourceName: 'places/ChIJLQEq84ld2EcRIT1eo-Ego2M',
          placeData: { placeId: 'ChIJLQEq84ld2EcRIT1eo-Ego2M' },
        },
      ],
      attributes: [
        {
          attributeKey: 'planning_reservation_recommended',
          valueType: 'REPEATED_ENUM',
          enumValues: ['RESERVATION_RECOMMENDED'],
          rawValue: { repeatedEnumValue: { setValues: ['RESERVATION_RECOMMENDED'] } },
          rawEnumValues: { setValues: ['RESERVATION_RECOMMENDED'] },
          displayValue: { setLabels: ['Reservations recommended'] },
        },
      ],
    };

    const response = await PUT(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/business-context', {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(200);
    expect(updateRestaurantBusinessContextMock).toHaveBeenCalledWith(
      'rest-1',
      expect.objectContaining({
        serviceAreas: [
          expect.objectContaining({
            googlePlaceId: 'ChIJLQEq84ld2EcRIT1eo-Ego2M',
            googlePlaceResourceName: 'places/ChIJLQEq84ld2EcRIT1eo-Ego2M',
          }),
        ],
        attributes: [
          expect.objectContaining({
            valueType: 'multienum',
            enumValues: ['RESERVATION_RECOMMENDED'],
            rawValue: { repeatedEnumValue: { setValues: ['RESERVATION_RECOMMENDED'] } },
            rawEnumValues: { setValues: ['RESERVATION_RECOMMENDED'] },
            displayValue: { setLabels: ['Reservations recommended'] },
          }),
        ],
      }),
      undefined,
      expect.objectContaining({
        changeOrigin: 'owner',
        changedByUserId: 'user-1',
        changedVia: 'ops_business_context_api',
      }),
      { expectedRevision: null },
    );
  });

  it('rejects malformed persisted ids and DB enum values before service calls', async () => {
    resolveRestaurantIdMock.mockResolvedValue('rest-1');
    ensureRestaurantAdminAccessMock.mockResolvedValue({ userId: 'user-1' });

    const invalidIdResponse = await PUT(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/business-context', {
        method: 'PUT',
        body: JSON.stringify({
          serviceAreas: [
            {
              id: 'local-service-area',
              displayName: 'Cambridge',
              areaType: 'region',
            },
          ],
        }),
      }),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(invalidIdResponse.status).toBe(400);

    const invalidEnumResponse = await PUT(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/business-context', {
        method: 'PUT',
        body: JSON.stringify({
          attributes: [
            {
              attributeKey: 'has_wifi',
              valueType: 'unknown',
            },
          ],
        }),
      }),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(invalidEnumResponse.status).toBe(400);
    expect(updateRestaurantBusinessContextMock).not.toHaveBeenCalled();
  });

  it('returns shared auth responses without calling the business-context service', async () => {
    resolveRestaurantIdMock.mockResolvedValue('rest-1');
    ensureRestaurantAdminAccessMock.mockResolvedValue(
      NextResponse.json({ error: 'Authentication required' }, { status: 401 }),
    );

    const response = await GET(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/business-context'),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(401);
    expect(getRestaurantBusinessContextMock).not.toHaveBeenCalled();
  });
});
