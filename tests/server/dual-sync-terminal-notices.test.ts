import { describe, expect, it, vi } from 'vitest';

import {
  buildGoogleWriteTerminalNotice,
  createSupabaseGoogleWriteTerminalNoticePersistence,
  deliverClaimedGoogleWriteNotices,
  emitOverdueGoogleWriteNotice,
  materializeGoogleWriteTerminalNotice,
  reconcileGoogleWriteTerminalNotices,
  terminalNoticeSla,
} from '@/server/dual-sync/notifications/terminal';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

describe('terminal Google write notices', () => {
  it('requires a fresh preview for an unknown provider outcome', () => {
    // Given
    const terminalAt = '2026-08-09T10:00:00.000Z';

    // When
    const notice = buildGoogleWriteTerminalNotice({
      restaurantId: 'rest-1',
      grantId: 'grant-1',
      status: 'outcome_unknown',
      reasonCode: 'provider_outcome_unknown',
      terminalAt,
    });

    // Then
    expect(notice).toMatchObject({
      status: 'outcome_unknown',
      instruction: 'refresh_then_create_new_preview',
      requiresFreshPreview: true,
      terminalAt,
      slaDueAt: '2026-08-11T10:00:00.000Z',
    });
  });

  it('classifies unresolved notices overdue only after the forty-eight-hour SLA', () => {
    // Given
    const dueAt = '2026-08-11T10:00:00.000Z';

    // When
    const states = [
      terminalNoticeSla({ deliveredAt: null, dueAt, now: dueAt }),
      terminalNoticeSla({ deliveredAt: null, dueAt, now: '2026-08-11T10:00:00.001Z' }),
      terminalNoticeSla({
        deliveredAt: '2026-08-10T10:00:00.000Z',
        dueAt,
        now: '2026-08-12T10:00:00.000Z',
      }),
    ];

    // Then
    expect(states).toEqual(['pending', 'overdue', 'delivered']);
  });

  it('emits a metadata-only operational notice for an overdue delivery', async () => {
    // Given
    const emit = vi.fn(async () => undefined);

    // When
    await emitOverdueGoogleWriteNotice({
      notification: { emit },
      restaurantId: 'rest-1',
      grantId: 'grant-1',
      status: 'failed',
      reasonCode: 'provider_rejected',
      dueAt: '2026-08-11T10:00:00.000Z',
    });

    // Then
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'google_write_notice_overdue',
        restaurantId: 'rest-1',
        errorCode: 'provider_rejected',
        metadata: { grantId: 'grant-1', status: 'failed', dueAt: '2026-08-11T10:00:00.000Z' },
      }),
    );
  });

  it('materializes a terminal event with the safe reason and exact terminal timestamp', async () => {
    // Given
    const materialize = vi.fn(async () => ({ noticeId: 'notice-1' }));

    // When
    const result = await materializeGoogleWriteTerminalNotice(
      {
        restaurantId: 'rest-1',
        grantId: 'grant-1',
        eventId: 'event-1',
        status: 'outcome_unknown',
        reasonCode: 'provider_outcome_unknown',
        terminalAt: '2026-08-09T10:00:00.000Z',
      },
      { materialize },
    );

    // Then
    expect(result).toEqual({ noticeId: 'notice-1' });
    expect(materialize).toHaveBeenCalledWith({
      restaurantId: 'rest-1',
      grantId: 'grant-1',
      eventId: 'event-1',
      terminalKind: 'outcome_unknown',
      safeReasonCode: 'provider_outcome_unknown',
      terminalAt: '2026-08-09T10:00:00.000Z',
    });
  });

  it('claims, emits, and finalizes terminal notices without provider content', async () => {
    // Given
    const claim = vi.fn(async () => [
      {
        noticeId: 'notice-1',
        restaurantId: 'rest-1',
        grantId: 'grant-1',
        leaseToken: 'lease-1',
        terminalKind: 'outcome_unknown' as const,
        safeReasonCode: 'provider_outcome_unknown',
        terminalAt: '2026-08-09T10:00:00.000Z',
      },
    ]);
    const recoverDispatched = vi.fn(async () => 0);
    const dispatch = vi.fn(async () => undefined);
    const finalize = vi.fn(async () => undefined);
    const emit = vi.fn(async () => ({ outcome: 'confirmed_success' as const }));

    // When
    const result = await deliverClaimedGoogleWriteNotices({
      persistence: { claim, recoverDispatched, dispatch, finalize },
      notification: { emit },
      workerId: 'worker-1',
      now: '2026-08-09T10:01:00.000Z',
      limit: 999,
      leaseSeconds: 60,
    });

    // Then
    expect(result).toEqual({ claimed: 1, delivered: 1, failed: 0, outcomeUnknown: 0 });
    expect(claim).toHaveBeenCalledWith({
      workerId: 'worker-1',
      limit: 100,
      leaseSeconds: 60,
      now: '2026-08-09T10:01:00.000Z',
    });
    expect(recoverDispatched).toHaveBeenCalledWith({
      limit: 100,
      now: '2026-08-09T10:01:00.000Z',
    });
    expect(dispatch).toHaveBeenCalledWith({
      restaurantId: 'rest-1',
      noticeId: 'notice-1',
      workerId: 'worker-1',
      leaseToken: 'lease-1',
      dispatchKey: 'gbp-terminal:notice-1:lease-1',
      now: '2026-08-09T10:01:00.000Z',
    });
    expect(dispatch.mock.invocationCallOrder[0]).toBeLessThan(emit.mock.invocationCallOrder[0]!);
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'google_write_terminal',
        restaurantId: 'rest-1',
        errorCode: 'provider_outcome_unknown',
        metadata: expect.objectContaining({
          instruction: 'refresh_then_create_new_preview',
          requiresFreshPreview: true,
        }),
      }),
    );
    expect(finalize).toHaveBeenCalledWith({
      restaurantId: 'rest-1',
      noticeId: 'notice-1',
      workerId: 'worker-1',
      leaseToken: 'lease-1',
      outcome: 'delivered',
      safeErrorCode: null,
      now: '2026-08-09T10:01:00.000Z',
    });
    expect(JSON.stringify(emit.mock.calls)).not.toContain('providerBody');
  });

  it('retries a definitive rejection using only a safe error code', async () => {
    // Given
    const claim = vi.fn(async () => [
      {
        noticeId: 'notice-1',
        restaurantId: 'rest-1',
        grantId: 'grant-1',
        leaseToken: 'lease-1',
        terminalKind: 'failed' as const,
        safeReasonCode: 'provider_rejected',
        terminalAt: '2026-08-09T10:00:00.000Z',
      },
    ]);
    const recoverDispatched = vi.fn(async () => 0);
    const dispatch = vi.fn(async () => undefined);
    const finalize = vi.fn(async () => undefined);

    // When
    const result = await deliverClaimedGoogleWriteNotices({
      persistence: { claim, recoverDispatched, dispatch, finalize },
      notification: {
        emit: vi.fn(async () => ({
          outcome: 'definitive_rejection' as const,
          retryable: true,
          safeErrorCode: 'webhook_retryable_429',
        })),
      },
      workerId: 'worker-1',
      now: '2026-08-09T10:01:00.000Z',
    });

    // Then
    expect(result).toEqual({ claimed: 1, delivered: 0, failed: 1, outcomeUnknown: 0 });
    expect(finalize).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'retryable_failure',
        safeErrorCode: 'webhook_retryable_429',
      }),
    );
    expect(JSON.stringify(finalize.mock.calls)).not.toContain('secret provider body');
  });

  it('recovers a dispatched notice as outcome unknown without repeating the external call', async () => {
    // Given
    const notice = {
      noticeId: 'notice-1',
      restaurantId: 'rest-1',
      grantId: 'grant-1',
      leaseToken: 'lease-1',
      terminalKind: 'consumed' as const,
      safeReasonCode: 'provider_succeeded',
      terminalAt: '2026-08-09T10:00:00.000Z',
    };
    let status: 'pending' | 'claimed' | 'dispatched' | 'outcome_unknown' = 'pending';
    const recoverDispatched = vi.fn(async () => {
      if (status !== 'dispatched') return 0;
      status = 'outcome_unknown';
      return 1;
    });
    const claim = vi.fn(async () => {
      if (status !== 'pending') return [];
      status = 'claimed';
      return [notice];
    });
    const dispatch = vi.fn(async () => {
      if (status !== 'claimed') throw new Error('not claimed');
      status = 'dispatched';
    });
    const finalize = vi.fn(async () => {
      throw new Error('simulated finalize outage');
    });
    const emit = vi.fn(async () => ({ outcome: 'confirmed_success' as const }));

    // When
    const first = deliverClaimedGoogleWriteNotices({
      persistence: { claim, recoverDispatched, dispatch, finalize },
      notification: { emit },
      workerId: 'worker-1',
      now: '2026-08-09T10:01:00.000Z',
    });
    await expect(first).rejects.toThrow('simulated finalize outage');
    const recovered = await deliverClaimedGoogleWriteNotices({
      persistence: { claim, recoverDispatched, dispatch, finalize },
      notification: { emit },
      workerId: 'worker-2',
      now: '2026-08-09T10:03:00.000Z',
    });

    // Then
    expect(recovered).toEqual({
      claimed: 0,
      delivered: 0,
      failed: 0,
      outcomeUnknown: 1,
    });
    expect(emit).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(finalize).toHaveBeenCalledTimes(1);
    expect(status).toBe('outcome_unknown');
  });

  it('terminalizes an ambiguous transport result as outcome unknown', async () => {
    const claim = vi.fn(async () => [
      {
        noticeId: 'notice-1',
        restaurantId: 'rest-1',
        grantId: 'grant-1',
        leaseToken: 'lease-1',
        terminalKind: 'failed' as const,
        safeReasonCode: 'provider_rejected',
        terminalAt: '2026-08-09T10:00:00.000Z',
      },
    ]);
    const finalize = vi.fn(async () => undefined);
    const result = await deliverClaimedGoogleWriteNotices({
      persistence: {
        claim,
        recoverDispatched: vi.fn(async () => 0),
        dispatch: vi.fn(async () => undefined),
        finalize,
      },
      notification: {
        emit: vi.fn(async () => ({
          outcome: 'ambiguous_failure' as const,
          safeErrorCode: 'webhook_delivery_ambiguous',
        })),
      },
      workerId: 'worker-1',
      now: '2026-08-09T10:01:00.000Z',
    });
    expect(result).toEqual({ claimed: 1, delivered: 0, failed: 0, outcomeUnknown: 1 });
    expect(finalize).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'outcome_unknown',
        safeErrorCode: 'webhook_delivery_ambiguous',
      }),
    );
  });

  it('terminalizes a non-retryable definitive rejection', async () => {
    const finalize = vi.fn(async () => undefined);
    const result = await deliverClaimedGoogleWriteNotices({
      persistence: {
        recoverDispatched: vi.fn(async () => 0),
        claim: vi.fn(async () => [
          {
            noticeId: 'notice-1',
            restaurantId: 'rest-1',
            grantId: 'grant-1',
            leaseToken: 'lease-1',
            terminalKind: 'failed' as const,
            safeReasonCode: 'provider_rejected',
            terminalAt: '2026-08-09T10:00:00.000Z',
          },
        ]),
        dispatch: vi.fn(async () => undefined),
        finalize,
      },
      notification: {
        emit: vi.fn(async () => ({
          outcome: 'definitive_rejection' as const,
          retryable: false,
          safeErrorCode: 'webhook_rejected_400',
        })),
      },
      workerId: 'worker-1',
      now: '2026-08-09T10:01:00.000Z',
    });
    expect(result).toEqual({ claimed: 1, delivered: 0, failed: 1, outcomeUnknown: 0 });
    expect(finalize).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'terminal_failure',
        safeErrorCode: 'webhook_rejected_400',
      }),
    );
  });

  it('delegates missing-notice selection to the anti-join RPC before its limit', async () => {
    // Given
    const grants = Array.from({ length: 101 }, (_, index) => ({
      id: `grant-${index + 1}`,
      materialized: index < 100,
    }));
    const rpc = vi.fn(async () => ({
      data: grants
        .filter((grant) => !grant.materialized)
        .slice(0, 50)
        .map((grant) => ({ id: `notice-${grant.id}`, grant_id: grant.id })),
      error: null,
    }));
    const client = { rpc } as unknown as SupabaseClient<Database>;

    // When
    const result = await reconcileGoogleWriteTerminalNotices({
      client,
      limit: 50,
      now: '2026-08-09T10:00:00.000Z',
    });

    // Then
    expect(result).toEqual({ considered: 1, materialized: 1, failed: 0 });
    expect(rpc).toHaveBeenCalledWith('reconcile_missing_gbp_terminal_notices_v1', {
      p_limit: 50,
      p_now: '2026-08-09T10:00:00.000Z',
    });
    expect(JSON.stringify(rpc.mock.calls)).not.toContain('gbp_write_grants_v1');
  });

  it('persists dispatch before delivery and recovers only through the dedicated RPCs', async () => {
    const rpc = vi.fn(async (name: string) => ({
      data: name === 'recover_stale_gbp_dispatched_notices_v1' ? [{ id: 'notice-1' }] : {},
      error: null,
    }));
    const persistence = createSupabaseGoogleWriteTerminalNoticePersistence({
      rpc,
    } as unknown as SupabaseClient<Database>);

    await persistence.dispatch({
      restaurantId: 'rest-1',
      noticeId: 'notice-1',
      workerId: 'worker-1',
      leaseToken: 'lease-1',
      dispatchKey: 'gbp-terminal:notice-1:lease-1',
      now: '2026-08-09T10:01:00.000Z',
    });
    const recovered = await persistence.recoverDispatched({
      limit: 50,
      now: '2026-08-09T10:03:00.000Z',
    });

    expect(rpc).toHaveBeenNthCalledWith(1, 'dispatch_gbp_terminal_notice_v1', {
      p_restaurant_id: 'rest-1',
      p_notice_id: 'notice-1',
      p_worker_id: 'worker-1',
      p_lease_token: 'lease-1',
      p_dispatch_key: 'gbp-terminal:notice-1:lease-1',
      p_now: '2026-08-09T10:01:00.000Z',
    });
    expect(rpc).toHaveBeenNthCalledWith(2, 'recover_stale_gbp_dispatched_notices_v1', {
      p_limit: 50,
      p_now: '2026-08-09T10:03:00.000Z',
    });
    expect(recovered).toBe(1);
  });
});
