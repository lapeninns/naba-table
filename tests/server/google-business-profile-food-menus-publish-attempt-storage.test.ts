import { describe, expect, it, vi } from 'vitest';

import {
  finishFoodMenusPublishAttempt,
  markFoodMenusPublishAttemptRunning,
  openFoodMenusPublishAttempt,
} from '@/server/google-business-profile/food-menus-publish-attempt-storage';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

interface MockChain {
  readonly insert: ReturnType<typeof vi.fn>;
  readonly update: ReturnType<typeof vi.fn>;
  readonly select: ReturnType<typeof vi.fn>;
  readonly eq: ReturnType<typeof vi.fn>;
  readonly single: ReturnType<typeof vi.fn>;
}

function makeChain(result: unknown): MockChain {
  const chain: Partial<MockChain> = {};
  Object.assign(chain, {
    insert: vi.fn(() => chain as MockChain),
    update: vi.fn(() => chain as MockChain),
    select: vi.fn(() => chain as MockChain),
    eq: vi.fn(() => chain as MockChain),
    single: vi.fn(async () => ({ data: result, error: null })),
  });
  return chain as MockChain;
}

function makeClient(chains: MockChain[]): SupabaseClient<Database> {
  const queue = [...chains];
  return {
    from: vi.fn(() => {
      const chain = queue.shift();
      if (!chain) {
        throw new Error('Unexpected Supabase table call');
      }
      return chain;
    }),
  } as unknown as SupabaseClient<Database>;
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

describe('GBP FoodMenus publish attempt storage', () => {
  it('opens publish attempts with provider and hash metadata', async () => {
    const openChain = makeChain(makePublishAttemptRow());
    const client = makeClient([openChain]);

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

    expect(openChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurant_id: 'rest-1',
        provider: 'google_business_profile',
        status: 'pending',
        publish_mode: 'manual',
        update_mask: ['menus'],
        projected_payload_hash: 'projection-hash',
        baseline_google_hash: 'baseline-hash',
      }),
    );
    expect(attempt.id).toBe('attempt-1');
    expect(attempt.projectedPayloadHash).toBe('projection-hash');
  });

  it('marks attempts running and finishes them with response or error payloads', async () => {
    const runningChain = makeChain(
      makePublishAttemptRow({
        status: 'running',
        started_at: '2026-05-02T18:00:30.000Z',
      }),
    );
    const finishChain = makeChain(
      makePublishAttemptRow({
        status: 'failed',
        google_response: { error: 'denied' },
        error_code: 'GBP_FOOD_MENUS_PUBLISH_FAILED',
        error_message: 'Unable to publish Google FoodMenus.',
        finished_at: '2026-05-02T18:01:00.000Z',
      }),
    );
    const client = makeClient([runningChain, finishChain]);

    const running = await markFoodMenusPublishAttemptRunning({ client, attemptId: 'attempt-1' });
    const failed = await finishFoodMenusPublishAttempt({
      client,
      attemptId: 'attempt-1',
      status: 'failed',
      googleResponse: { error: 'denied' },
      errorCode: 'GBP_FOOD_MENUS_PUBLISH_FAILED',
      errorMessage: 'Unable to publish Google FoodMenus.',
    });

    expect(runningChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'running',
        started_at: expect.any(String),
      }),
    );
    expect(runningChain.eq).toHaveBeenCalledWith('id', 'attempt-1');
    expect(finishChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        google_response: { error: 'denied' },
        error_code: 'GBP_FOOD_MENUS_PUBLISH_FAILED',
        error_message: 'Unable to publish Google FoodMenus.',
        finished_at: expect.any(String),
      }),
    );
    expect(running.status).toBe('running');
    expect(failed.status).toBe('failed');
    expect(failed.errorCode).toBe('GBP_FOOD_MENUS_PUBLISH_FAILED');
  });
});
