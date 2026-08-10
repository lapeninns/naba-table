import { describe, expect, it, vi } from 'vitest';

import {
  createSupabaseGooglePubsubPersistence,
  persistGooglePubsubDelivery,
} from '@/server/dual-sync/pubsub/persistence';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

const DELIVERY = {
  kind: 'supported',
  messageId: 'message-1',
  eventHash: 'a'.repeat(64),
  eventType: 'GOOGLE_UPDATE',
  externalAccountId: 'account-1',
  externalLocationId: 'location-1',
  publishedAt: '2026-08-09T10:00:00.000Z',
} as const;

describe('atomic Pub/Sub persistence orchestration', () => {
  it('lets the database derive the exact current fence from account and location metadata', async () => {
    // Given
    const recordAtomic = vi.fn(async () => ({
      processingResult: 'accepted' as const,
      receiptInserted: true,
      jobId: 'job-1',
    }));

    // When
    const result = await persistGooglePubsubDelivery(
      { subscription: 'projects/p/subscriptions/s', delivery: DELIVERY },
      { recordAtomic, clock: () => new Date('2026-08-09T10:01:00.000Z') },
    );

    // Then
    expect(result).toEqual({ outcome: 'accepted' });
    expect(recordAtomic).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription: 'projects/p/subscriptions/s',
        messageId: 'message-1',
        eventHash: 'a'.repeat(64),
        eventType: 'GOOGLE_UPDATE',
        processingResult: 'accepted',
        externalAccountId: 'account-1',
        externalLocationId: 'location-1',
        idempotencyKey: 'pubsub:projects/p/subscriptions/s:message-1',
        receivedAt: '2026-08-09T10:01:00.000Z',
      }),
    );
    expect(JSON.stringify(recordAtomic.mock.calls)).not.toContain('restaurantId');
  });

  it('binds account metadata to the atomic receipt-and-enqueue RPC without caller tenant identity', async () => {
    // Given
    const chain: Record<string, unknown> = {};
    const fluent = vi.fn(() => chain);
    Object.assign(chain, {
      select: fluent,
      eq: fluent,
      maybeSingle: vi.fn(async () => ({ data: { id: 'registry-1' }, error: null })),
    });
    const rpc = vi.fn(async () => ({
      data: { processing_result: 'accepted', receipt_inserted: true, job_id: 'job-1' },
      error: null,
    }));
    const client = { from: vi.fn(() => chain), rpc } as unknown as SupabaseClient<Database>;

    // When
    const result = await createSupabaseGooglePubsubPersistence(client).persist({
      subscription: 'projects/p/subscriptions/s',
      delivery: DELIVERY,
    });

    // Then
    expect(result).toEqual({ outcome: 'accepted' });
    expect(rpc).toHaveBeenCalledWith(
      'record_gbp_pubsub_and_enqueue_v1',
      expect.objectContaining({
        p_registry_id: 'registry-1',
        p_external_account_id: 'account-1',
        p_external_location_id: 'location-1',
        p_restaurant_id: null,
        p_external_profile_row_id: null,
        p_external_profile_id: null,
        p_connection_generation: null,
        p_consent_epoch: null,
      }),
    );
  });

  it('records poison and unmatched deliveries without a tenant fence and acknowledges duplicates', async () => {
    // Given
    const recordAtomic = vi
      .fn()
      .mockResolvedValueOnce({
        processingResult: 'unmatched' as const,
        receiptInserted: true,
        jobId: null,
      })
      .mockResolvedValueOnce({
        processingResult: 'duplicate' as const,
        receiptInserted: false,
        jobId: null,
      });
    const poison = {
      kind: 'ignored',
      messageId: 'message-2',
      eventHash: 'b'.repeat(64),
      eventType: null,
      reason: 'malformed_notification',
      publishedAt: null,
    } as const;

    // When
    const [unmatched, ignored] = await Promise.all([
      persistGooglePubsubDelivery(
        { subscription: 'projects/p/subscriptions/s', delivery: DELIVERY },
        { recordAtomic },
      ),
      persistGooglePubsubDelivery(
        { subscription: 'projects/p/subscriptions/s', delivery: poison },
        { recordAtomic },
      ),
    ]);

    // Then
    expect([unmatched.outcome, ignored.outcome]).toEqual(['unmatched', 'duplicate']);
    expect(recordAtomic.mock.calls.map(([input]) => input.externalAccountId)).toEqual([
      'account-1',
      null,
    ]);
    expect(recordAtomic.mock.calls.map(([input]) => input.processingResult)).toEqual([
      'accepted',
      'poison',
    ]);
  });
});
