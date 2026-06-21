import { describe, expect, it, vi } from 'vitest';

import {
  claimFoodMenusImportReviewDecision,
  markFoodMenusImportReviewDecisionFailed,
  listPendingFoodMenusImportReviews,
  markFoodMenusImportReviewDecision,
  readFoodMenusImportReviewForRestaurant,
  replacePendingFoodMenusImportReviews,
} from '@/server/google-business-profile/food-menus-import-review-storage';

import type { GoogleFoodMenusImportReview } from '@/server/google-business-profile/food-menus';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

interface MockChain {
  readonly update: ReturnType<typeof vi.fn>;
  readonly select: ReturnType<typeof vi.fn>;
  readonly eq: ReturnType<typeof vi.fn>;
  readonly order: ReturnType<typeof vi.fn>;
  readonly maybeSingle: ReturnType<typeof vi.fn>;
  readonly then: (resolve: (value: { data: unknown[]; error: null }) => unknown) => unknown;
}

function makeChain(result: unknown | unknown[]): MockChain {
  const rows = Array.isArray(result) ? result : [result];
  const chain: Partial<MockChain> = {};
  Object.assign(chain, {
    update: vi.fn(() => chain as MockChain),
    select: vi.fn(() => chain as MockChain),
    eq: vi.fn(() => chain as MockChain),
    order: vi.fn(() => chain as MockChain),
    maybeSingle: vi.fn(async () => ({ data: rows[0] ?? null, error: null })),
    then: (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
      Promise.resolve(resolve({ data: rows, error: null })),
  });
  return chain as MockChain;
}

function makeClient(chains: MockChain[]): {
  client: SupabaseClient<Database>;
  rpcMock: ReturnType<typeof vi.fn>;
} {
  const queue = [...chains];
  const rpcMock = vi.fn(async () => ({ data: [makeImportReviewRow()], error: null }));
  return {
    client: {
      from: vi.fn(() => {
        const chain = queue.shift();
        if (!chain) {
          throw new Error('Unexpected Supabase table call');
        }
        return chain;
      }),
      rpc: rpcMock,
    } as unknown as SupabaseClient<Database>,
    rpcMock,
  };
}

function makeImportReviewRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'review-1',
    restaurant_id: 'rest-1',
    google_snapshot_id: 'google-snapshot-1',
    projection_snapshot_id: 'projection-snapshot-1',
    menu_item_id: 'item-1',
    external_item_id: 'starter-paneer',
    target_kind: 'food',
    google_path: 'menus[0].sections[0].items[0]',
    google_section_label: 'Starters',
    google_item_name: 'Chilli Paneer',
    match_status: 'matched',
    match_confidence: 'previous_identity',
    suggested_patch: { shortDescription: 'Updated' },
    warnings: [],
    decision_status: 'pending',
    decision_action: null,
    decided_by_user_id: null,
    decided_at: null,
    created_at: '2026-05-02T18:00:00.000Z',
    updated_at: '2026-05-02T18:00:00.000Z',
    ...overrides,
  };
}

function makeReview(): GoogleFoodMenusImportReview {
  return {
    items: [
      {
        targetKind: 'food',
        googlePath: 'menus[0].sections[0].items[0]',
        googleSectionLabel: 'Starters',
        googleItemName: 'Chilli Paneer',
        match: {
          status: 'matched',
          confidence: 'previous_identity',
          localItemId: 'item-1',
          externalItemId: 'starter-paneer',
        },
        suggestedPatch: { shortDescription: 'Updated' },
        warnings: ['description_changed'],
      },
    ],
  };
}

describe('GBP FoodMenus import-review storage', () => {
  it('replaces pending reviews through the bulk RPC payload', async () => {
    const { client, rpcMock } = makeClient([]);

    const rows = await replacePendingFoodMenusImportReviews({
      client,
      restaurantId: 'rest-1',
      googleSnapshotId: 'google-snapshot-1',
      projectionSnapshotId: 'projection-snapshot-1',
      review: makeReview(),
    });

    expect(rpcMock).toHaveBeenCalledWith('replace_pending_food_menus_import_reviews', {
      p_google_snapshot_id: 'google-snapshot-1',
      p_projection_snapshot_id: 'projection-snapshot-1',
      p_restaurant_id: 'rest-1',
      p_reviews: [
        expect.objectContaining({
          menu_item_id: 'item-1',
          external_item_id: 'starter-paneer',
          target_kind: 'food',
          match_status: 'matched',
          match_confidence: 'previous_identity',
          warnings: ['description_changed'],
        }),
      ],
    });
    expect(rows[0]?.id).toBe('review-1');
  });

  it('lists and reads restaurant-scoped import reviews', async () => {
    const listChain = makeChain([makeImportReviewRow()]);
    const readChain = makeChain(makeImportReviewRow({ id: 'review-2' }));
    const { client } = makeClient([listChain, readChain]);

    const rows = await listPendingFoodMenusImportReviews({ client, restaurantId: 'rest-1' });
    const row = await readFoodMenusImportReviewForRestaurant({
      client,
      restaurantId: 'rest-1',
      reviewId: 'review-2',
    });

    expect(listChain.eq).toHaveBeenCalledWith('restaurant_id', 'rest-1');
    expect(listChain.eq).toHaveBeenCalledWith('decision_status', 'pending');
    expect(listChain.order).toHaveBeenCalledWith('google_path', { ascending: true });
    expect(readChain.eq).toHaveBeenCalledWith('restaurant_id', 'rest-1');
    expect(readChain.eq).toHaveBeenCalledWith('id', 'review-2');
    expect(rows[0]?.id).toBe('review-1');
    expect(row?.id).toBe('review-2');
  });

  it('claims, marks, and fails decisions using guarded status transitions', async () => {
    const claimChain = makeChain(
      makeImportReviewRow({
        decision_status: 'processing',
        decision_action: 'apply_to_nabatable',
        decided_by_user_id: 'user-1',
      }),
    );
    const markChain = makeChain(
      makeImportReviewRow({
        decision_status: 'applied',
        decision_action: 'apply_to_nabatable',
        decided_by_user_id: 'user-1',
      }),
    );
    const failChain = makeChain(
      makeImportReviewRow({
        decision_status: 'failed',
        decision_action: 'apply_to_nabatable',
        decided_by_user_id: 'user-1',
      }),
    );
    const { client } = makeClient([claimChain, markChain, failChain]);

    const claimed = await claimFoodMenusImportReviewDecision({
      client,
      restaurantId: 'rest-1',
      reviewId: 'review-1',
      decisionAction: 'apply_to_nabatable',
      decidedByUserId: 'user-1',
    });
    const marked = await markFoodMenusImportReviewDecision({
      client,
      restaurantId: 'rest-1',
      reviewId: 'review-1',
      decisionStatus: 'applied',
      decisionAction: 'apply_to_nabatable',
      decidedByUserId: 'user-1',
    });
    const failed = await markFoodMenusImportReviewDecisionFailed({
      client,
      restaurantId: 'rest-1',
      reviewId: 'review-1',
      decisionAction: 'apply_to_nabatable',
      decidedByUserId: 'user-1',
    });

    expect(claimChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        decision_status: 'processing',
        decision_action: 'apply_to_nabatable',
        decided_by_user_id: 'user-1',
      }),
    );
    expect(claimChain.eq).toHaveBeenCalledWith('decision_status', 'pending');
    expect(markChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        decision_status: 'applied',
        decision_action: 'apply_to_nabatable',
        decided_by_user_id: 'user-1',
      }),
    );
    expect(markChain.eq).toHaveBeenCalledWith('decision_status', 'processing');
    expect(failChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        decision_status: 'failed',
        decision_action: 'apply_to_nabatable',
        decided_by_user_id: 'user-1',
      }),
    );
    expect(failChain.eq).toHaveBeenCalledWith('decision_status', 'processing');
    expect(claimed.decisionStatus).toBe('processing');
    expect(marked.decisionStatus).toBe('applied');
    expect(failed.decisionStatus).toBe('failed');
  });
});
