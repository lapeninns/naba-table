import { describe, expect, it, vi } from 'vitest';

import {
  cancelOutboundCandidate,
  listOutboundCandidates,
  upsertOutboundCandidate,
} from '@/server/dual-sync/outbound/candidates';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

interface MockChain {
  readonly update: ReturnType<typeof vi.fn>;
  readonly insert: ReturnType<typeof vi.fn>;
  readonly select: ReturnType<typeof vi.fn>;
  readonly eq: ReturnType<typeof vi.fn>;
  readonly in: ReturnType<typeof vi.fn>;
  readonly order: ReturnType<typeof vi.fn>;
  readonly limit: ReturnType<typeof vi.fn>;
  readonly maybeSingle: ReturnType<typeof vi.fn>;
  readonly single: ReturnType<typeof vi.fn>;
  readonly then: (resolve: (value: { data: unknown; error: unknown }) => unknown) => unknown;
}

function makeChain(result: unknown, error: unknown = null): MockChain {
  const chain: Partial<MockChain> = {};
  const fluent = vi.fn(() => chain as MockChain);
  Object.assign(chain, {
    insert: fluent,
    update: fluent,
    select: fluent,
    eq: fluent,
    in: fluent,
    order: fluent,
    limit: fluent,
    maybeSingle: vi.fn(async () => ({ data: result, error })),
    single: vi.fn(async () => ({ data: result, error })),
    then: (resolve: (value: { data: unknown; error: unknown }) => unknown) =>
      Promise.resolve(resolve({ data: result, error })),
  });
  return chain as MockChain;
}

function clientFor(chain: MockChain) {
  return { from: vi.fn(() => chain) } as unknown as SupabaseClient<Database>;
}

function clientForSequence(chains: MockChain[]) {
  return {
    from: vi.fn(() => {
      const next = chains.shift();
      if (!next) {
        throw new Error('Unexpected query chain');
      }
      return next;
    }),
  } as unknown as SupabaseClient<Database>;
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
  it('refreshes an existing candidate only while it is still open', async () => {
    const existing = makeCandidateRow();
    const refreshed = makeCandidateRow({
      proposed_value: 'Newer name',
      proposed_value_hash: 'hash-newer',
    });
    const readChain = makeChain(existing);
    const updateChain = makeChain(refreshed);

    const candidate = await upsertOutboundCandidate({
      client: clientForSequence([readChain, updateChain]),
      restaurantId: 'rest-1',
      sectionKey: 'profile',
      fieldKey: 'profile.name',
      proposedValue: 'Newer name',
      proposedValueHash: 'hash-newer',
      baselineGbpHash: 'hash-old',
      createdByUserId: 'user-2',
    });

    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        proposed_value: 'Newer name',
        proposed_value_hash: 'hash-newer',
        created_by_user_id: 'user-2',
      }),
    );
    expect(updateChain.eq).toHaveBeenCalledWith('id', 'cand-1');
    expect(updateChain.eq).toHaveBeenCalledWith('status', 'open');
    expect(candidate.proposedValueHash).toBe('hash-newer');
  });

  it('retries as an open-row update when a concurrent insert wins the partial unique index race', async () => {
    const insertRaceError = {
      code: '23505',
      message: 'duplicate key value violates unique constraint',
    };
    const readMissingChain = makeChain(null);
    const insertChain = makeChain(null, insertRaceError);
    const readRacedChain = makeChain(makeCandidateRow({ id: 'cand-raced' }));
    const updateChain = makeChain(makeCandidateRow({ id: 'cand-raced' }));

    const candidate = await upsertOutboundCandidate({
      client: clientForSequence([readMissingChain, insertChain, readRacedChain, updateChain]),
      restaurantId: 'rest-1',
      sectionKey: 'profile',
      fieldKey: 'profile.name',
      proposedValue: 'Latest name',
      proposedValueHash: 'hash-latest',
      baselineGbpHash: 'hash-old',
    });

    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurant_id: 'rest-1',
        provider: 'google_business_profile',
        field_key: 'profile.name',
        status: 'open',
      }),
    );
    expect(updateChain.eq).toHaveBeenCalledWith('id', 'cand-raced');
    expect(updateChain.eq).toHaveBeenCalledWith('status', 'open');
    expect(candidate.id).toBe('cand-raced');
  });

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
