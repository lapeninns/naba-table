import { describe, expect, it, vi } from 'vitest';

import {
  claimFoodMenusImportReviewDecision,
  finishFoodMenusPublishAttempt,
  markFoodMenusImportReviewDecision,
  openFoodMenusPublishAttempt,
  readFoodMenusImportReviewForRestaurant,
  recordFoodMenusProjection,
  recordFoodMenusSnapshot,
  replacePendingFoodMenusImportReviews,
  saveProjectedFoodMenusIdentities,
} from '@/server/google-business-profile/food-menus-storage';

import type { GoogleFoodMenusProjection } from '@/server/google-business-profile/food-menus';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

interface MockChain {
  readonly insert: ReturnType<typeof vi.fn>;
  readonly upsert: ReturnType<typeof vi.fn>;
  readonly update: ReturnType<typeof vi.fn>;
  readonly select: ReturnType<typeof vi.fn>;
  readonly eq: ReturnType<typeof vi.fn>;
  readonly order: ReturnType<typeof vi.fn>;
  readonly maybeSingle: ReturnType<typeof vi.fn>;
  readonly single: ReturnType<typeof vi.fn>;
  readonly then: (resolve: (value: { data: unknown[]; error: null }) => unknown) => unknown;
}

function makeChain(result: unknown | unknown[]): MockChain {
  const rows = Array.isArray(result) ? result : [result];
  const chain: Partial<MockChain> = {};
  Object.assign(chain, {
    insert: vi.fn(() => chain as MockChain),
    upsert: vi.fn(() => chain as MockChain),
    update: vi.fn(() => chain as MockChain),
    select: vi.fn(() => chain as MockChain),
    eq: vi.fn(() => chain as MockChain),
    order: vi.fn(() => chain as MockChain),
    maybeSingle: vi.fn(async () => ({ data: rows[0] ?? null, error: null })),
    single: vi.fn(async () => ({ data: rows[0] ?? null, error: null })),
    then: (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
      Promise.resolve(resolve({ data: rows, error: null })),
  });
  return chain as MockChain;
}

function makeClient(chains: MockChain[]): {
  client: SupabaseClient<Database>;
  fromMock: ReturnType<typeof vi.fn>;
  rpcMock: ReturnType<typeof vi.fn>;
} {
  const queue = [...chains];
  const fromMock = vi.fn(() => {
    const chain = queue.shift();
    if (!chain) {
      throw new Error('Unexpected Supabase table call');
    }
    return chain;
  });
  const rpcMock = vi.fn(async () => ({ data: [], error: null }));
  return {
    client: { from: fromMock, rpc: rpcMock } as unknown as SupabaseClient<Database>,
    fromMock,
    rpcMock,
  };
}

function makeSnapshotRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'snapshot-1',
    restaurant_id: 'rest-1',
    external_profile_id: null,
    provider: 'google_business_profile',
    snapshot_kind: 'google_pull',
    source: 'manual',
    status: 'succeeded',
    food_menus_name: 'accounts/123/locations/456/foodMenus',
    raw_food_menus: { name: 'accounts/123/locations/456/foodMenus', menus: [] },
    canonical_food_menus: { name: 'accounts/123/locations/456/foodMenus', menus: [] },
    projection_metadata: {},
    snapshot_hash: 'hash-1',
    google_etag: null,
    error_code: null,
    error_message: null,
    pulled_at: '2026-05-02T18:00:00.000Z',
    created_by_user_id: null,
    created_at: '2026-05-02T18:00:00.000Z',
    ...overrides,
  };
}

function makeIdentityRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'identity-1',
    restaurant_id: 'rest-1',
    snapshot_id: 'snapshot-1',
    menu_item_id: 'item-1',
    external_item_id: 'starter-paneer',
    stable_key: 'foodMenu.item.starters/default.starter-paneer',
    item_name: 'Chilli Paneer',
    section_key: 'starters/default',
    section_label: 'Starters',
    google_path: 'menus[0].sections[0].items[0]',
    google_option_paths: [],
    created_at: '2026-05-02T18:00:00.000Z',
    ...overrides,
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

function makePublishAttemptRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'attempt-1',
    restaurant_id: 'rest-1',
    projection_snapshot_id: 'projection-snapshot-1',
    baseline_google_snapshot_id: 'google-snapshot-1',
    provider: 'google_business_profile',
    status: 'pending',
    publish_mode: 'manual',
    food_menus_name: 'accounts/123/locations/456/foodMenus',
    update_mask: ['menus'],
    projected_payload: { name: 'accounts/123/locations/456/foodMenus', menus: [] },
    google_response: null,
    baseline_google_hash: 'baseline-hash',
    projected_payload_hash: 'projection-hash',
    error_code: null,
    error_message: null,
    requested_by_user_id: 'user-1',
    started_at: null,
    finished_at: null,
    created_at: '2026-05-02T18:00:00.000Z',
    updated_at: '2026-05-02T18:00:00.000Z',
    ...overrides,
  };
}

describe('GBP FoodMenus storage helpers', () => {
  it('records FoodMenus snapshots with provider, hashes, and payload metadata', async () => {
    const insertChain = makeChain(makeSnapshotRow());
    const { client, fromMock } = makeClient([insertChain]);

    const snapshot = await recordFoodMenusSnapshot({
      client,
      restaurantId: 'rest-1',
      snapshotKind: 'google_pull',
      source: 'manual',
      foodMenusName: 'accounts/123/locations/456/foodMenus',
      rawFoodMenus: { name: 'accounts/123/locations/456/foodMenus', menus: [] },
      canonicalFoodMenus: { name: 'accounts/123/locations/456/foodMenus', menus: [] },
      snapshotHash: 'hash-1',
      pulledAt: '2026-05-02T18:00:00.000Z',
    });

    expect(fromMock).toHaveBeenCalledWith('restaurant_gbp_food_menu_snapshots');
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurant_id: 'rest-1',
        provider: 'google_business_profile',
        snapshot_kind: 'google_pull',
        source: 'manual',
        status: 'succeeded',
        snapshot_hash: 'hash-1',
      }),
    );
    expect(snapshot.restaurantId).toBe('rest-1');
    expect(snapshot.snapshotHash).toBe('hash-1');
  });

  it('reuses an existing FoodMenus snapshot when the snapshot hash already exists', async () => {
    const duplicateError = {
      code: '23505',
      message:
        'duplicate key value violates unique constraint "restaurant_gbp_food_menu_snapshots_hash_idx"',
    };
    const insertChain = makeChain(makeSnapshotRow());
    insertChain.single.mockResolvedValueOnce({ data: null, error: duplicateError });
    const existingChain = makeChain(makeSnapshotRow({ id: 'snapshot-existing' }));
    const { client } = makeClient([insertChain, existingChain]);

    const snapshot = await recordFoodMenusSnapshot({
      client,
      restaurantId: 'rest-1',
      snapshotKind: 'google_pull',
      source: 'scheduled',
      foodMenusName: 'accounts/123/locations/456/foodMenus',
      rawFoodMenus: { name: 'accounts/123/locations/456/foodMenus', menus: [] },
      canonicalFoodMenus: { name: 'accounts/123/locations/456/foodMenus', menus: [] },
      snapshotHash: 'hash-1',
    });

    expect(existingChain.eq).toHaveBeenCalledWith('restaurant_id', 'rest-1');
    expect(existingChain.eq).toHaveBeenCalledWith('snapshot_kind', 'google_pull');
    expect(existingChain.eq).toHaveBeenCalledWith('snapshot_hash', 'hash-1');
    expect(snapshot.id).toBe('snapshot-existing');
  });

  it('persists projected identities with deterministic conflict keys', async () => {
    const upsertChain = makeChain([makeIdentityRow()]);
    const { client } = makeClient([upsertChain]);

    const identities = await saveProjectedFoodMenusIdentities({
      client,
      restaurantId: 'rest-1',
      snapshotId: 'snapshot-1',
      identities: [
        {
          stableKey: 'foodMenu.item.starters/default.starter-paneer',
          localItemId: 'item-1',
          externalItemId: 'starter-paneer',
          itemName: 'Chilli Paneer',
          sectionKey: 'starters/default',
          sectionLabel: 'Starters',
          googlePath: 'menus[0].sections[0].items[0]',
          googleOptionPaths: [],
        },
      ],
    });

    expect(upsertChain.upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          restaurant_id: 'rest-1',
          snapshot_id: 'snapshot-1',
          menu_item_id: 'item-1',
          stable_key: 'foodMenu.item.starters/default.starter-paneer',
        }),
      ],
      { onConflict: 'restaurant_id,snapshot_id,stable_key' },
    );
    expect(identities[0]?.stableKey).toBe('foodMenu.item.starters/default.starter-paneer');
  });

  it('records projection snapshots and identity rows together', async () => {
    const snapshotChain = makeChain(makeSnapshotRow({ snapshot_kind: 'nabatable_projection' }));
    const identityChain = makeChain([makeIdentityRow()]);
    const { client } = makeClient([snapshotChain, identityChain]);
    const projection: GoogleFoodMenusProjection = {
      foodMenus: { name: 'accounts/123/locations/456/foodMenus', menus: [] },
      skippedItems: [],
      identities: [
        {
          stableKey: 'foodMenu.item.starters/default.starter-paneer',
          localItemId: 'item-1',
          externalItemId: 'starter-paneer',
          itemName: 'Chilli Paneer',
          sectionKey: 'starters/default',
          sectionLabel: 'Starters',
          googlePath: 'menus[0].sections[0].items[0]',
          googleOptionPaths: [],
        },
      ],
    };

    const result = await recordFoodMenusProjection({
      client,
      restaurantId: 'rest-1',
      projection,
      snapshotHash: 'projection-hash',
    });

    expect(snapshotChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshot_kind: 'nabatable_projection',
        projection_metadata: { skippedItems: [], identityCount: 1 },
        snapshot_hash: 'projection-hash',
      }),
    );
    expect(identityChain.upsert).toHaveBeenCalledTimes(1);
    expect(result.identities).toHaveLength(1);
  });

  it('supersedes pending import reviews before inserting fresh suggestions', async () => {
    const { client, rpcMock } = makeClient([]);
    rpcMock.mockResolvedValueOnce({ data: [makeImportReviewRow()], error: null });

    const rows = await replacePendingFoodMenusImportReviews({
      client,
      restaurantId: 'rest-1',
      googleSnapshotId: 'google-snapshot-1',
      projectionSnapshotId: 'projection-snapshot-1',
      review: {
        items: [
          {
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
            warnings: [],
          },
        ],
        localItemsMissingFromGoogle: [],
      },
    });

    expect(rpcMock).toHaveBeenCalledWith(
      'replace_pending_food_menus_import_reviews',
      expect.objectContaining({
        p_restaurant_id: 'rest-1',
        p_google_snapshot_id: 'google-snapshot-1',
        p_projection_snapshot_id: 'projection-snapshot-1',
        p_reviews: [
          expect.objectContaining({
            menu_item_id: 'item-1',
            match_status: 'matched',
          }),
        ],
      }),
    );
    expect(rows[0]?.suggestedPatch).toEqual({ shortDescription: 'Updated' });
  });

  it('reads and marks an import-review decision by restaurant', async () => {
    const readChain = makeChain(makeImportReviewRow());
    const claimChain = makeChain(
      makeImportReviewRow({
        decision_status: 'processing',
        decision_action: 'apply_to_nabatable',
        decided_by_user_id: 'user-1',
      }),
    );
    const updateChain = makeChain(
      makeImportReviewRow({
        decision_status: 'applied',
        decision_action: 'apply_to_nabatable',
        decided_by_user_id: 'user-1',
        decided_at: '2026-05-02T18:02:00.000Z',
      }),
    );
    const { client } = makeClient([readChain, claimChain, updateChain]);

    const review = await readFoodMenusImportReviewForRestaurant({
      client,
      restaurantId: 'rest-1',
      reviewId: 'review-1',
    });
    const claimed = await claimFoodMenusImportReviewDecision({
      client,
      restaurantId: 'rest-1',
      reviewId: 'review-1',
      decisionAction: 'apply_to_nabatable',
      decidedByUserId: 'user-1',
    });
    const decided = await markFoodMenusImportReviewDecision({
      client,
      restaurantId: 'rest-1',
      reviewId: 'review-1',
      decisionStatus: 'applied',
      decisionAction: 'apply_to_nabatable',
      decidedByUserId: 'user-1',
    });

    expect(readChain.eq).toHaveBeenCalledWith('restaurant_id', 'rest-1');
    expect(readChain.eq).toHaveBeenCalledWith('id', 'review-1');
    expect(review?.id).toBe('review-1');
    expect(claimChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        decision_status: 'processing',
        decision_action: 'apply_to_nabatable',
        decided_by_user_id: 'user-1',
      }),
    );
    expect(claimChain.eq).toHaveBeenCalledWith('decision_status', 'pending');
    expect(claimed.decisionStatus).toBe('processing');
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        decision_status: 'applied',
        decision_action: 'apply_to_nabatable',
        decided_by_user_id: 'user-1',
      }),
    );
    expect(updateChain.eq).toHaveBeenCalledWith('restaurant_id', 'rest-1');
    expect(updateChain.eq).toHaveBeenCalledWith('id', 'review-1');
    expect(updateChain.eq).toHaveBeenCalledWith('decision_status', 'processing');
    expect(decided.decisionStatus).toBe('applied');
    expect(decided.decisionAction).toBe('apply_to_nabatable');
  });

  it('opens and finishes publish attempts without calling Google', async () => {
    const openChain = makeChain(makePublishAttemptRow());
    const finishChain = makeChain(
      makePublishAttemptRow({
        status: 'preflight_failed',
        error_code: 'baseline_changed',
        error_message: 'Baseline hash changed',
        finished_at: '2026-05-02T18:01:00.000Z',
      }),
    );
    const { client } = makeClient([openChain, finishChain]);

    const attempt = await openFoodMenusPublishAttempt({
      client,
      restaurantId: 'rest-1',
      foodMenusName: 'accounts/123/locations/456/foodMenus',
      projectedPayload: { name: 'accounts/123/locations/456/foodMenus', menus: [] },
      projectedPayloadHash: 'projection-hash',
      baselineGoogleHash: 'baseline-hash',
      projectionSnapshotId: 'projection-snapshot-1',
      baselineGoogleSnapshotId: 'google-snapshot-1',
      requestedByUserId: 'user-1',
    });

    const finished = await finishFoodMenusPublishAttempt({
      client,
      attemptId: attempt.id,
      status: 'preflight_failed',
      errorCode: 'baseline_changed',
      errorMessage: 'Baseline hash changed',
    });

    expect(openChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'pending',
        publish_mode: 'manual',
        update_mask: ['menus'],
        projected_payload_hash: 'projection-hash',
      }),
    );
    expect(finishChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'preflight_failed',
        error_code: 'baseline_changed',
        error_message: 'Baseline hash changed',
      }),
    );
    expect(finishChain.eq).toHaveBeenCalledWith('id', 'attempt-1');
    expect(finished.status).toBe('preflight_failed');
  });
});
