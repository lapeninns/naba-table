import { describe, expect, it, vi } from 'vitest';

import {
  cancelOutboundCandidate,
  listOutboundCandidates,
} from '@/server/dual-sync/outbound/candidates';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

interface MockChain {
  readonly update: ReturnType<typeof vi.fn>;
  readonly select: ReturnType<typeof vi.fn>;
  readonly eq: ReturnType<typeof vi.fn>;
  readonly in: ReturnType<typeof vi.fn>;
  readonly order: ReturnType<typeof vi.fn>;
  readonly limit: ReturnType<typeof vi.fn>;
  readonly maybeSingle: ReturnType<typeof vi.fn>;
  readonly then: (resolve: (value: { data: unknown; error: null }) => unknown) => unknown;
}

function makeChain(result: unknown): MockChain {
  const chain: Partial<MockChain> = {};
  const fluent = vi.fn(() => chain as MockChain);
  Object.assign(chain, {
    update: fluent,
    select: fluent,
    eq: fluent,
    in: fluent,
    order: fluent,
    limit: fluent,
    maybeSingle: vi.fn(async () => ({ data: result, error: null })),
    then: (resolve: (value: { data: unknown; error: null }) => unknown) =>
      Promise.resolve(resolve({ data: result, error: null })),
  });
  return chain as MockChain;
}

function clientFor(chain: MockChain) {
  return { from: vi.fn(() => chain) } as unknown as SupabaseClient<Database>;
}

function makeCandidateRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cand-1',
    restaurant_id: 'rest-1',
    provider: 'google_business_profile',
    section_key: 'profile',
    field_key: 'profile.name',
    proposed_value: 'New name',
    proposed_value_hash: 'hash-new',
    baseline_gbp_hash: 'hash-old',
    status: 'open',
    source: 'core_write',
    created_by_user_id: 'user-1',
    resolved_at: null,
    created_at: '2026-05-10T10:00:00.000Z',
    updated_at: '2026-05-10T10:01:00.000Z',
    ...overrides,
  };
}

describe('dual-sync outbound candidate helpers', () => {
  it('lists scoped candidates with status filters and a capped limit', async () => {
    const chain = makeChain([
      makeCandidateRow(),
      makeCandidateRow({ id: 'cand-2', status: 'cancelled' }),
    ]);
    const client = clientFor(chain);

    const candidates = await listOutboundCandidates({
      client,
      restaurantId: 'rest-1',
      statuses: ['open', 'cancelled'],
      limit: 500,
    });

    expect(client.from).toHaveBeenCalledWith('dual_sync_outbound_candidates');
    expect(chain.eq).toHaveBeenCalledWith('restaurant_id', 'rest-1');
    expect(chain.eq).toHaveBeenCalledWith('provider', 'google_business_profile');
    expect(chain.in).toHaveBeenCalledWith('status', ['open', 'cancelled']);
    expect(chain.limit).toHaveBeenCalledWith(200);
    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toMatchObject({
      id: 'cand-1',
      restaurantId: 'rest-1',
      fieldKey: 'profile.name',
      status: 'open',
    });
  });

  it('cancels only open candidates scoped to the restaurant and provider', async () => {
    const chain = makeChain(
      makeCandidateRow({
        status: 'cancelled',
        resolved_at: '2026-05-10T10:02:00.000Z',
      }),
    );
    const client = clientFor(chain);

    const candidate = await cancelOutboundCandidate({
      client,
      restaurantId: 'rest-1',
      candidateId: 'cand-1',
      resolvedAt: '2026-05-10T10:02:00.000Z',
    });

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'cancelled',
        resolved_at: '2026-05-10T10:02:00.000Z',
      }),
    );
    expect(chain.eq).toHaveBeenCalledWith('id', 'cand-1');
    expect(chain.eq).toHaveBeenCalledWith('restaurant_id', 'rest-1');
    expect(chain.eq).toHaveBeenCalledWith('provider', 'google_business_profile');
    expect(chain.eq).toHaveBeenCalledWith('status', 'open');
    expect(candidate?.status).toBe('cancelled');
  });

  it('returns null when no scoped open candidate is cancellable', async () => {
    const chain = makeChain(null);

    await expect(
      cancelOutboundCandidate({
        client: clientFor(chain),
        restaurantId: 'rest-1',
        candidateId: 'cand-other',
      }),
    ).resolves.toBeNull();
  });
});
