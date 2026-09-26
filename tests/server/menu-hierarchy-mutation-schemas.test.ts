import { describe, expect, it } from 'vitest';

import {
  MenuReorderSchema,
  RestaurantMenuItemInputSchema,
  RestaurantMenuItemPatchSchema,
  RestaurantMenuOptionInputSchema,
  RestaurantMenuSectionInputSchema,
} from '@/server/menu-hierarchy/types';

describe('menu hierarchy merge patches', () => {
  it('keeps only the attribute keys the client sent (no schema defaults leak in)', () => {
    const parsed = RestaurantMenuItemPatchSchema.parse({
      attributesMerge: { price: { amount: 9.5, currencyCode: 'gbp' } },
    });

    expect(parsed).toEqual({
      attributesMerge: { price: { amount: 9.5, currencyCode: 'GBP' } },
    });
  });

  it('keeps only the extension fields the client sent, per extension group', () => {
    const parsed = RestaurantMenuItemPatchSchema.parse({
      extensionsMerge: { availabilityPolicy: { soldOut: true } },
    });

    expect(parsed).toEqual({ extensionsMerge: { availabilityPolicy: { soldOut: true } } });
  });

  it('validates merge values and reports field paths', () => {
    const result = RestaurantMenuItemPatchSchema.safeParse({
      attributesMerge: { spiciness: 'VOLCANIC' },
      extensionsMerge: { availabilityPolicy: { availabilityStatus: 'maybe' } },
    });

    expect(result.success).toBe(false);
    const paths = result.error?.issues.map((issue) => issue.path.join('.')) ?? [];
    expect(paths).toContain('attributesMerge.spiciness');
    expect(paths).toContain('extensionsMerge.availabilityPolicy.availabilityStatus');
  });

  it('allows an explicit null to clear a nullable attribute', () => {
    expect(RestaurantMenuItemPatchSchema.parse({ attributesMerge: { spiciness: null } })).toEqual({
      attributesMerge: { spiciness: null },
    });
  });
});

describe('menu hierarchy create inputs', () => {
  it('leaves displayOrder unset so the server appends (max + 1)', () => {
    expect(RestaurantMenuSectionInputSchema.parse({}).displayOrder).toBeUndefined();
    expect(RestaurantMenuOptionInputSchema.parse({}).displayOrder).toBeUndefined();
    expect(
      RestaurantMenuItemInputSchema.parse({ itemKind: 'food', externalItemId: 'x' }).displayOrder,
    ).toBeUndefined();
  });

  it('accepts an idempotency key and initial options on item create', () => {
    const parsed = RestaurantMenuItemInputSchema.parse({
      itemKind: 'food',
      externalItemId: 'ops:1',
      idempotencyKey: 'c0ffee00-0000-4000-8000-000000000001',
      options: [{ externalOptionId: 'large', labels: [{ displayName: 'Large' }] }],
    });

    expect(parsed.idempotencyKey).toBe('c0ffee00-0000-4000-8000-000000000001');
    expect(parsed.options).toHaveLength(1);
  });

  it('rejects a too-short idempotency key', () => {
    expect(
      RestaurantMenuItemInputSchema.safeParse({
        itemKind: 'food',
        externalItemId: 'x',
        idempotencyKey: 'abc',
      }).success,
    ).toBe(false);
  });
});

describe('MenuReorderSchema', () => {
  const a = '00000000-0000-4000-8000-000000000001';
  const b = '00000000-0000-4000-8000-000000000002';

  it('accepts distinct ids', () => {
    expect(MenuReorderSchema.parse({ orderedIds: [a, b] })).toEqual({ orderedIds: [a, b] });
  });

  it('rejects duplicates, empty lists and non-uuid ids', () => {
    expect(MenuReorderSchema.safeParse({ orderedIds: [a, a] }).success).toBe(false);
    expect(MenuReorderSchema.safeParse({ orderedIds: [] }).success).toBe(false);
    expect(MenuReorderSchema.safeParse({ orderedIds: ['menu-1'] }).success).toBe(false);
  });
});
