import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authGetUserMock = vi.hoisted(() => vi.fn());
const requireAdminMembershipMock = vi.hoisted(() => vi.fn());
const repository = vi.hoisted(() => ({
  createRestaurantMenuItemIdempotent: vi.fn(),
  updateRestaurantMenuItem: vi.fn(),
  deleteRestaurantMenuItem: vi.fn(),
  createRestaurantMenuSection: vi.fn(),
  createRestaurantMenuOption: vi.fn(),
  reorderRestaurantMenuChildren: vi.fn(),
  updateRestaurantMenu: vi.fn(),
}));
const loggerMock = vi.hoisted(() => ({
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: vi.fn(async () => ({ auth: { getUser: authGetUserMock } })),
}));
vi.mock('@/server/team/access', () => ({ requireAdminMembership: requireAdminMembershipMock }));
vi.mock('@/server/security/events', () => ({ recordSecurityEvent: vi.fn() }));
vi.mock('@/lib/posthog/server', () => ({ captureServerException: vi.fn() }));
vi.mock('@/lib/logger', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, logger: loggerMock };
});
vi.mock('@/server/menu-hierarchy/repository', () => repository);

import { MenuHierarchyError } from '@/server/menu-hierarchy/errors';
import { PATCH as patchMenu } from '@/src/app/api/ops/restaurants/[id]/menus/[menuId]/route';
import { PATCH as patchOptionOrder } from '@/src/app/api/ops/restaurants/[id]/menus/[menuId]/sections/[sectionId]/items/[itemId]/options/order/route';
import { PATCH as patchItem } from '@/src/app/api/ops/restaurants/[id]/menus/[menuId]/sections/[sectionId]/items/[itemId]/route';
import { PATCH as patchItemOrder } from '@/src/app/api/ops/restaurants/[id]/menus/[menuId]/sections/[sectionId]/items/order/route';
import { POST as postItem } from '@/src/app/api/ops/restaurants/[id]/menus/[menuId]/sections/[sectionId]/items/route';
import { PATCH as patchSectionOrder } from '@/src/app/api/ops/restaurants/[id]/menus/[menuId]/sections/order/route';
import { POST as postSection } from '@/src/app/api/ops/restaurants/[id]/menus/[menuId]/sections/route';

import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '../../lib/security/csrf';

const CSRF_TOKEN = 'menu-mutation-csrf-token';
const BASE = 'https://example.com/api/ops/restaurants/rest-1/menus/menu-1';
const ID_A = '00000000-0000-4000-8000-00000000000a';
const ID_B = '00000000-0000-4000-8000-00000000000b';

function request(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    headers: { [CSRF_HEADER_NAME]: CSRF_TOKEN, cookie: `${CSRF_COOKIE_NAME}=${CSRF_TOKEN}` },
  });
}

const itemParams = () =>
  Promise.resolve({ id: 'rest-1', menuId: 'menu-1', sectionId: 'section-1', itemId: 'item-1' });
const sectionParams = () =>
  Promise.resolve({ id: 'rest-1', menuId: 'menu-1', sectionId: 'section-1' });

describe('menu mutation routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authGetUserMock.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'ops@example.com' } },
      error: null,
    });
    requireAdminMembershipMock.mockResolvedValue(undefined);
  });

  it('passes a partial quick-edit patch through as merge patches only', async () => {
    repository.updateRestaurantMenuItem.mockResolvedValue({ id: 'item-1' });

    const response = await patchItem(
      request(`${BASE}/sections/section-1/items/item-1`, 'PATCH', {
        attributesMerge: { price: { amount: 7.5, currencyCode: 'GBP' } },
        extensionsMerge: { availabilityPolicy: { soldOut: true } },
      }),
      { params: itemParams() },
    );

    expect(response.status).toBe(200);
    expect(repository.updateRestaurantMenuItem).toHaveBeenCalledWith(
      'rest-1',
      'menu-1',
      'section-1',
      'item-1',
      {
        attributesMerge: { price: { amount: 7.5, currencyCode: 'GBP' } },
        extensionsMerge: { availabilityPolicy: { soldOut: true } },
      },
    );
  });

  it('creates an item with its idempotency key and returns 201, or 200 on replay', async () => {
    repository.createRestaurantMenuItemIdempotent
      .mockResolvedValueOnce({ item: { id: 'item-1' }, replayed: false })
      .mockResolvedValueOnce({ item: { id: 'item-1' }, replayed: true });
    const body = {
      itemKind: 'food',
      externalItemId: 'ops:1',
      labels: [{ displayName: 'Paneer' }],
      idempotencyKey: 'c0ffee00-0000-4000-8000-000000000001',
      options: [{ externalOptionId: 'large', labels: [{ displayName: 'Large' }] }],
    };

    const first = await postItem(request(`${BASE}/sections/section-1/items`, 'POST', body), {
      params: sectionParams(),
    });
    const retry = await postItem(request(`${BASE}/sections/section-1/items`, 'POST', body), {
      params: sectionParams(),
    });

    expect(first.status).toBe(201);
    expect(retry.status).toBe(200);
    await expect(retry.json()).resolves.toEqual({ item: { id: 'item-1' } });
    expect(repository.createRestaurantMenuItemIdempotent).toHaveBeenCalledWith(
      'rest-1',
      'menu-1',
      'section-1',
      expect.objectContaining({
        idempotencyKey: 'c0ffee00-0000-4000-8000-000000000001',
        options: [expect.objectContaining({ externalOptionId: 'large' })],
      }),
    );
  });

  it('does not send a client display order for new sections', async () => {
    repository.createRestaurantMenuSection.mockResolvedValue({ id: 'section-2' });

    const response = await postSection(
      request(`${BASE}/sections`, 'POST', { labels: [{ displayName: 'Mains' }] }),
      { params: Promise.resolve({ id: 'rest-1', menuId: 'menu-1' }) },
    );

    expect(response.status).toBe(201);
    expect(repository.createRestaurantMenuSection.mock.calls[0]![2].displayOrder).toBeUndefined();
  });

  it.each([
    [
      'sections',
      () => patchSectionOrder,
      { id: 'rest-1', menuId: 'menu-1' },
      { level: 'sections', menuId: 'menu-1' },
    ],
    [
      'items',
      () => patchItemOrder,
      { id: 'rest-1', menuId: 'menu-1', sectionId: 'section-1' },
      { level: 'items', menuId: 'menu-1', sectionId: 'section-1' },
    ],
    [
      'options',
      () => patchOptionOrder,
      { id: 'rest-1', menuId: 'menu-1', sectionId: 'section-1', itemId: 'item-1' },
      { level: 'options', menuId: 'menu-1', sectionId: 'section-1', itemId: 'item-1' },
    ],
  ] as const)('reorders %s with one command', async (_level, handler, params, target) => {
    const order = [
      { id: ID_B, displayOrder: 0 },
      { id: ID_A, displayOrder: 1 },
    ];
    repository.reorderRestaurantMenuChildren.mockResolvedValue(order);

    const response = await handler()(
      request(`${BASE}/order`, 'PATCH', { orderedIds: [ID_B, ID_A] }),
      {
        params: Promise.resolve(params),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: { order } });
    expect(repository.reorderRestaurantMenuChildren).toHaveBeenCalledWith('rest-1', target, [
      ID_B,
      ID_A,
    ]);
  });

  it('rejects an invalid reorder body with C1 field errors', async () => {
    const response = await patchSectionOrder(
      request(`${BASE}/sections/order`, 'PATCH', { orderedIds: [ID_A, ID_A] }),
      { params: Promise.resolve({ id: 'rest-1', menuId: 'menu-1' }) },
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toMatchObject({
      code: 'VALIDATION_FAILED',
      fields: { orderedIds: expect.any(Array) },
    });
    expect(repository.reorderRestaurantMenuChildren).not.toHaveBeenCalled();
  });

  it('maps a stale order to 409 MENU_ORDER_STALE', async () => {
    repository.reorderRestaurantMenuChildren.mockRejectedValue(
      new MenuHierarchyError('order_stale'),
    );

    const response = await patchSectionOrder(
      request(`${BASE}/sections/order`, 'PATCH', { orderedIds: [ID_A, ID_B] }),
      { params: Promise.resolve({ id: 'rest-1', menuId: 'menu-1' }) },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: 'MENU_ORDER_STALE' });
  });

  it.each([
    ['not_found', 404, 'MENU_NOT_FOUND'],
    ['duplicate', 409, 'MENU_DUPLICATE'],
    ['idempotency_key_reused', 409, 'IDEMPOTENCY_KEY_REUSED'],
    ['invalid_argument', 400, 'MENU_INVALID'],
  ] as const)('maps %s to %i %s', async (kind, status, code) => {
    repository.updateRestaurantMenuItem.mockRejectedValue(new MenuHierarchyError(kind));

    const response = await patchItem(
      request(`${BASE}/sections/section-1/items/item-1`, 'PATCH', { active: false }),
      { params: itemParams() },
    );

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toMatchObject({ code, error: expect.any(String) });
  });

  it('never returns raw database text and logs through the logger, not console', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    repository.updateRestaurantMenu.mockRejectedValue({
      code: '57014',
      message: 'canceling statement due to statement timeout on restaurant_menus',
    });

    const response = await patchMenu(request(BASE, 'PATCH', { active: false }), {
      params: Promise.resolve({ id: 'rest-1', menuId: 'menu-1' }),
    });

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(body)).not.toContain('restaurant_menus');
    expect(loggerMock.error).toHaveBeenCalledWith(
      'api.internal_error',
      expect.objectContaining({ route: expect.stringContaining('menus') }),
    );
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('returns C1 errors for invalid JSON and invalid payloads', async () => {
    const invalidJson = await patchItem(
      request(`${BASE}/sections/section-1/items/item-1`, 'PATCH', '{not json'),
      { params: itemParams() },
    );
    expect(invalidJson.status).toBe(400);
    await expect(invalidJson.json()).resolves.toMatchObject({ code: 'INVALID_JSON' });

    const invalid = await patchItem(
      request(`${BASE}/sections/section-1/items/item-1`, 'PATCH', {
        attributesMerge: { spiciness: 'VOLCANIC' },
      }),
      { params: itemParams() },
    );
    expect(invalid.status).toBe(400);
    await expect(invalid.json()).resolves.toMatchObject({
      code: 'VALIDATION_FAILED',
      fields: { 'attributesMerge.spiciness': expect.any(Array) },
    });
  });
});
