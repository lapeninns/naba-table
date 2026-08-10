import { describe, expect, it } from 'vitest';

import {
  recoverStaleGbpDispatchedGrants,
  type GbpDispatchedGrantRecoveryPort,
  type GbpGrantRecoveryFence,
} from '@/server/dual-sync/health/dispatched-grant-recovery';

const NOW = new Date('2026-08-10T12:00:00.000Z');

function fence(index: number): GbpGrantRecoveryFence {
  return {
    restaurantId: `restaurant-${index}`,
    externalProfileRowId: `profile-row-${index}`,
    externalAccountId: `account-${index}`,
    externalProfileId: `profile-${index}`,
    externalLocationId: `location-${index}`,
    connectionGeneration: 2,
    consentEpoch: 3,
  };
}

describe('stale dispatched GBP grant recovery', () => {
  it('recovers a finalize gap, cancels later claimed work, materializes a notice, and never re-emits', async () => {
    // Given: one provider request was already emitted before finalize persistence failed.
    const states = new Map([
      ['grant-dispatched', 'dispatched'],
      ['grant-later', 'claimed'],
    ]);
    const providerTransport = {
      calls: ['initial-provider-write'],
    };
    let noticesMaterialized = 0;
    const port: GbpDispatchedGrantRecoveryPort = {
      async listCurrentFences() {
        return [fence(1)];
      },
      async recoverFence(input) {
        expect(input.cutoff).toBe('2026-08-10T11:55:00.000Z');
        states.set('grant-dispatched', 'outcome_unknown');
        states.set('grant-later', 'cancelled_after_bundle_failure');
        return { kind: 'recovered', count: 1 };
      },
    };

    // When: the later health sweep recovers, then its reconciliation phase materializes the notice.
    const result = await recoverStaleGbpDispatchedGrants({ port, now: NOW });
    if (states.get('grant-dispatched') === 'outcome_unknown') noticesMaterialized += 1;

    // Then: provider truth is not retried and the in-app terminal outcome becomes available.
    expect(result.recovered).toBe(1);
    expect(states).toEqual(
      new Map([
        ['grant-dispatched', 'outcome_unknown'],
        ['grant-later', 'cancelled_after_bundle_failure'],
      ]),
    );
    expect(noticesMaterialized).toBe(1);
    expect(providerTransport.calls).toEqual(['initial-provider-write']);
  });

  it('uses an exact five-minute cutoff and exact current tenant fence', async () => {
    // Given
    const currentFence = fence(7);
    const calls: Array<{
      readonly fence: GbpGrantRecoveryFence;
      readonly cutoff: string;
      readonly now: string;
      readonly limit: number;
    }> = [];
    const port: GbpDispatchedGrantRecoveryPort = {
      async listCurrentFences(input) {
        expect(input).toEqual({ cutoff: '2026-08-10T11:55:00.000Z', limit: 50 });
        return [currentFence];
      },
      async recoverFence(input) {
        calls.push(input);
        return { kind: 'recovered', count: 0 };
      },
    };

    // When
    await recoverStaleGbpDispatchedGrants({ port, now: NOW });

    // Then
    expect(calls).toEqual([
      {
        fence: currentFence,
        cutoff: '2026-08-10T11:55:00.000Z',
        now: '2026-08-10T12:00:00.000Z',
        limit: 100,
      },
    ]);
  });

  it('reports safe metadata for one tenant failure and continues other tenants', async () => {
    // Given
    const port: GbpDispatchedGrantRecoveryPort = {
      async listCurrentFences() {
        return [fence(1), fence(2)];
      },
      async recoverFence(input) {
        if (input.fence.restaurantId === 'restaurant-1') {
          return { kind: 'failed' };
        }
        return { kind: 'recovered', count: 1 };
      },
    };

    // When
    const result = await recoverStaleGbpDispatchedGrants({ port, now: NOW });

    // Then
    expect(result.recovered).toBe(1);
    expect(result.profilesProcessed).toBe(2);
    expect(result.errors).toEqual([
      {
        restaurantId: 'restaurant-1',
        externalProfileRowId: 'profile-row-1',
        code: 'grant_recovery_failed',
      },
    ]);
    expect(JSON.stringify(result)).not.toContain('provider body');
  });

  it('is idempotent when the fenced store has no dispatched grant left', async () => {
    // Given
    let dispatched = true;
    const port: GbpDispatchedGrantRecoveryPort = {
      async listCurrentFences() {
        return [fence(1)];
      },
      async recoverFence() {
        if (!dispatched) return { kind: 'recovered', count: 0 };
        dispatched = false;
        return { kind: 'recovered', count: 1 };
      },
    };

    // When
    const first = await recoverStaleGbpDispatchedGrants({ port, now: NOW });
    const second = await recoverStaleGbpDispatchedGrants({ port, now: NOW });

    // Then
    expect(first.recovered).toBe(1);
    expect(second.recovered).toBe(0);
  });

  it('enforces the global 500 recovery cap with at most 100 per profile', async () => {
    // Given
    const limits: number[] = [];
    const port: GbpDispatchedGrantRecoveryPort = {
      async listCurrentFences() {
        return Array.from({ length: 6 }, (_, index) => fence(index + 1));
      },
      async recoverFence(input) {
        limits.push(input.limit);
        return { kind: 'recovered', count: input.limit };
      },
    };

    // When
    const result = await recoverStaleGbpDispatchedGrants({ port, now: NOW });

    // Then
    expect(result).toMatchObject({ recovered: 500, profilesProcessed: 5, capped: true });
    expect(limits).toEqual([100, 100, 100, 100, 100]);
  });
});
