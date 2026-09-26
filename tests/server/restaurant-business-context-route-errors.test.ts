import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ensureRestaurantAdminAccessMock = vi.hoisted(() => vi.fn());
const resolveRestaurantIdMock = vi.hoisted(() => vi.fn());
const getRestaurantBusinessContextMock = vi.hoisted(() => vi.fn());
const updateRestaurantBusinessContextMock = vi.hoisted(() => vi.fn());
const loggerErrorMock = vi.hoisted(() => vi.fn());

vi.mock('@/app/api/ops/restaurants/[id]/_shared', () => ({
  ensureRestaurantAdminAccess: ensureRestaurantAdminAccessMock,
  resolveRestaurantId: resolveRestaurantIdMock,
}));

vi.mock('@/server/restaurants/businessContext', async (importOriginal) => ({
  ...(await importOriginal<typeof BusinessContextModule>()),
  getRestaurantBusinessContext: getRestaurantBusinessContextMock,
  updateRestaurantBusinessContext: updateRestaurantBusinessContextMock,
}));

vi.mock('@/lib/logger', async (importOriginal) => ({
  ...(await importOriginal<typeof LoggerModule>()),
  logger: { error: loggerErrorMock, warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/posthog/server', () => ({ captureServerException: vi.fn() }));

vi.mock('@/server/supabase', () => ({ getServiceSupabaseClient: vi.fn() }));

import {
  BusinessContextStaleWriteError,
  BusinessContextValidationError,
} from '@/server/restaurants/businessContext';
import { GET, PUT } from '@/src/app/api/ops/restaurants/[id]/business-context/route';

import type * as LoggerModule from '@/lib/logger';
import type * as BusinessContextModule from '@/server/restaurants/businessContext';

const SENTINEL = 'SECRET_DB_DETAIL';

function put(body: unknown) {
  return PUT(
    new NextRequest('https://example.com/api/ops/restaurants/rest-1/business-context', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: 'rest-1' }) },
  );
}

describe('business-context route error contract (C1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveRestaurantIdMock.mockResolvedValue('rest-1');
    ensureRestaurantAdminAccessMock.mockResolvedValue({ userId: 'user-1' });
  });

  it('@contract passes every section and the expected revision to one domain call', async () => {
    updateRestaurantBusinessContextMock.mockResolvedValue({
      revision: 5,
      core: {},
      providerSnapshot: {},
    });

    const response = await put({
      expectedRevision: 4,
      businessDetails: { businessStatus: 'open', isServiceAreaBusiness: true },
      categories: [{ displayName: 'Gastropub', isPrimary: true }],
      links: [{ linkType: 'website', url: 'https://example.com' }],
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ revision: 5 });
    expect(updateRestaurantBusinessContextMock).toHaveBeenCalledTimes(1);
    const [restaurantId, input, , provenance, options] =
      updateRestaurantBusinessContextMock.mock.calls[0] ?? [];
    expect(restaurantId).toBe('rest-1');
    expect(Object.keys(input as object).sort()).toEqual(['businessDetails', 'categories', 'links']);
    expect(input).not.toHaveProperty('expectedRevision');
    expect(provenance).toMatchObject({ changeOrigin: 'owner', changedByUserId: 'user-1' });
    expect(options).toEqual({ expectedRevision: 4 });
  });

  it('@contract returns 400 VALIDATION_FAILED with field paths for an invalid body', async () => {
    const response = await put({ links: [{ linkType: 'website', url: 'not a url' }] });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(body.fields['links.0.url']).toEqual(['Link URL must be valid']);
    expect(updateRestaurantBusinessContextMock).not.toHaveBeenCalled();
  });

  it('@contract returns 400 VALIDATION_FAILED for a negative expected revision', async () => {
    const response = await put({ expectedRevision: -1, categories: [] });

    expect(response.status).toBe(400);
    expect((await response.json()).fields).toHaveProperty('expectedRevision');
  });

  it('@contract maps a domain validation error to 400 with its field', async () => {
    updateRestaurantBusinessContextMock.mockRejectedValue(
      new BusinessContextValidationError(
        'categories',
        'Only one business category can be marked as primary',
      ),
    );

    const response = await put({ categories: [{ displayName: 'A' }] });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: 'VALIDATION_FAILED',
      fields: { categories: ['Only one business category can be marked as primary'] },
    });
  });

  it('@contract maps a stale revision to 409 STALE_WRITE with the current revision', async () => {
    updateRestaurantBusinessContextMock.mockRejectedValue(new BusinessContextStaleWriteError(9));

    const response = await put({ expectedRevision: 4, categories: [] });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: 'STALE_WRITE',
      details: { currentRevision: 9 },
    });
  });

  it('@contract maps a unique violation to 409 without database text', async () => {
    updateRestaurantBusinessContextMock.mockRejectedValue({
      code: '23505',
      message: `${SENTINEL} duplicate key value violates unique constraint`,
    });

    const response = await put({ categories: [] });

    expect(response.status).toBe(409);
    const text = await response.text();
    expect(text).not.toContain(SENTINEL);
    expect(JSON.parse(text)).toMatchObject({ code: 'BUSINESS_CONTEXT_CONFLICT' });
  });

  it('@contract returns a generic 500 INTERNAL_ERROR for unexpected failures', async () => {
    updateRestaurantBusinessContextMock.mockRejectedValue(new Error(`${SENTINEL} boom`));

    const response = await put({ categories: [] });

    expect(response.status).toBe(500);
    const text = await response.text();
    expect(text).not.toContain(SENTINEL);
    expect(JSON.parse(text)).toMatchObject({ code: 'INTERNAL_ERROR' });
    expect(loggerErrorMock).toHaveBeenCalledWith(
      'api.internal_error',
      expect.objectContaining({
        route: 'ops.restaurants.business-context',
        restaurantId: 'rest-1',
      }),
    );
  });

  it('@contract GET failures return a generic 500 INTERNAL_ERROR', async () => {
    getRestaurantBusinessContextMock.mockRejectedValue(new Error(`${SENTINEL} boom`));

    const response = await GET(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/business-context'),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(500);
    const text = await response.text();
    expect(text).not.toContain(SENTINEL);
    expect(JSON.parse(text)).toMatchObject({ code: 'INTERNAL_ERROR' });
  });

  it('returns 400 for a malformed JSON body', async () => {
    const response = await PUT(
      new NextRequest('https://example.com/api/ops/restaurants/rest-1/business-context', {
        method: 'PUT',
        body: '{not json',
      }),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'INVALID_JSON' });
  });
});
