import { describe, expect, it, vi } from 'vitest';

import {
  buildFieldPolicyVersionSnapshot,
  buildRegistry,
  ensureActiveFieldPolicyVersion,
  recordFieldPolicyVersion,
} from '@/server/dual-sync/registry';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

const emptySnapshot = {
  profile: null,
  operatingHours: { weekly: [] },
  servicePeriods: { periods: [] },
  businessContext: {
    categories: [],
    serviceAreas: [],
    attributes: [],
    serviceItems: [],
  },
  foodMenus: { items: [] },
} as const;

interface MockChain {
  readonly insert: ReturnType<typeof vi.fn>;
  readonly update: ReturnType<typeof vi.fn>;
  readonly select: ReturnType<typeof vi.fn>;
  readonly eq: ReturnType<typeof vi.fn>;
  readonly single: ReturnType<typeof vi.fn>;
  readonly maybeSingle: ReturnType<typeof vi.fn>;
  readonly then: (resolve: (value: { data: unknown; error: null }) => unknown) => unknown;
}

function makeChain(result: unknown): MockChain {
  const chain: Partial<MockChain> = {};
  Object.assign(chain, {
    insert: vi.fn(() => chain as MockChain),
    update: vi.fn(() => chain as MockChain),
    select: vi.fn(() => chain as MockChain),
    eq: vi.fn(() => chain as MockChain),
    single: vi.fn(async () => ({ data: result, error: null })),
    maybeSingle: vi.fn(async () => ({ data: result, error: null })),
    then: (resolve: (value: { data: unknown; error: null }) => unknown) =>
      Promise.resolve(resolve({ data: result, error: null })),
  });
  return chain as MockChain;
}

function makePolicyVersionRow(over: Record<string, unknown> = {}) {
  return {
    id: 'policy-version-1',
    restaurant_id: null,
    provider: 'google_business_profile',
    version_label: '2026-05-10-local',
    policy_hash: 'policy-hash',
    policy_snapshot: { fieldCount: 1, fields: [] },
    field_count: 1,
    active: false,
    created_by_user_id: null,
    activated_at: null,
    created_at: '2026-05-10T00:00:00.000Z',
    ...over,
  };
}

function clientFor(chain: MockChain) {
  return { from: vi.fn(() => chain) } as unknown as SupabaseClient<Database>;
}

function clientForSequence(chains: MockChain[]) {
  const from = vi.fn();
  for (const chain of chains) {
    from.mockReturnValueOnce(chain);
  }
  return { from } as unknown as SupabaseClient<Database>;
}

describe('dual-sync field policy versions', () => {
  it('builds deterministic policy snapshots without functions or live values', () => {
    const registry = buildRegistry({
      coreSnapshot: emptySnapshot,
      gbpSnapshot: emptySnapshot,
    });

    const first = buildFieldPolicyVersionSnapshot(registry);
    const second = buildFieldPolicyVersionSnapshot([...registry].reverse());
    const serialized = JSON.stringify(first.snapshot);

    expect(first.policyHash).toBe(second.policyHash);
    expect(first.snapshot.fieldCount).toBe(registry.length);
    expect(serialized).not.toContain('normalizeCoreValue');
    expect(serialized).not.toContain('canonicalizeCoreValue');
    expect(first.snapshot.fields[0]).toMatchObject({
      fieldKey: expect.any(String),
      sectionKey: expect.any(String),
      kind: expect.any(String),
      policy: expect.objectContaining({
        authority: expect.any(String),
        riskLevel: expect.any(String),
        semanticComparator: expect.any(String),
        canonicalizer: expect.any(String),
      }),
    });
  });

  it('records a policy version row with computed hash and field count', async () => {
    const registry = buildRegistry({
      coreSnapshot: emptySnapshot,
      gbpSnapshot: emptySnapshot,
    });
    const { policyHash } = buildFieldPolicyVersionSnapshot(registry);
    const chain = makeChain(makePolicyVersionRow({ policy_hash: policyHash }));
    const client = clientFor(chain);

    const row = await recordFieldPolicyVersion({
      client,
      registry,
      versionLabel: '2026-05-10-local',
      restaurantId: 'rest-1',
      active: true,
      createdByUserId: 'user-1',
      activatedAt: '2026-05-10T00:00:00.000Z',
    });

    expect(client.from).toHaveBeenCalledWith('dual_sync_field_policy_versions');
    const insert = chain.insert.mock.calls[0]?.[0];
    expect(insert).toMatchObject({
      restaurant_id: 'rest-1',
      provider: 'google_business_profile',
      version_label: '2026-05-10-local',
      policy_hash: policyHash,
      field_count: registry.length,
      active: true,
      created_by_user_id: 'user-1',
      activated_at: '2026-05-10T00:00:00.000Z',
    });
    expect(JSON.stringify(insert)).not.toContain('normalizeCoreValue');
    expect(row.id).toBe('policy-version-1');
    expect(row.policyHash).toBe(policyHash);
  });

  it('reuses an active policy version when the current hash already exists', async () => {
    const registry = buildRegistry({
      coreSnapshot: emptySnapshot,
      gbpSnapshot: emptySnapshot,
    });
    const { policyHash } = buildFieldPolicyVersionSnapshot(registry);
    const chain = makeChain(
      makePolicyVersionRow({
        restaurant_id: 'rest-1',
        policy_hash: policyHash,
        active: true,
      }),
    );
    const client = clientFor(chain);

    const row = await ensureActiveFieldPolicyVersion({
      client,
      registry,
      restaurantId: 'rest-1',
      createdByUserId: 'user-1',
    });

    expect(client.from).toHaveBeenCalledWith('dual_sync_field_policy_versions');
    expect(chain.eq).toHaveBeenCalledWith('restaurant_id', 'rest-1');
    expect(chain.eq).toHaveBeenCalledWith('policy_hash', policyHash);
    expect(chain.eq).toHaveBeenCalledWith('active', true);
    expect(chain.update).not.toHaveBeenCalled();
    expect(chain.insert).not.toHaveBeenCalled();
    expect(row.policyHash).toBe(policyHash);
  });

  it('activates a new restaurant policy version when the hash is not active', async () => {
    const registry = buildRegistry({
      coreSnapshot: emptySnapshot,
      gbpSnapshot: emptySnapshot,
    });
    const { policyHash } = buildFieldPolicyVersionSnapshot(registry);
    const lookup = makeChain(null);
    const deactivate = makeChain(null);
    const insert = makeChain(
      makePolicyVersionRow({
        restaurant_id: 'rest-1',
        policy_hash: policyHash,
        active: true,
        created_by_user_id: 'user-1',
        activated_at: '2026-05-10T12:15:00.000Z',
      }),
    );
    const client = clientForSequence([lookup, deactivate, insert]);

    const row = await ensureActiveFieldPolicyVersion({
      client,
      registry,
      restaurantId: 'rest-1',
      createdByUserId: 'user-1',
      activatedAt: '2026-05-10T12:15:00.000Z',
    });

    expect(deactivate.update).toHaveBeenCalledWith({ active: false });
    expect(deactivate.eq).toHaveBeenCalledWith('restaurant_id', 'rest-1');
    expect(deactivate.eq).toHaveBeenCalledWith('active', true);
    expect(insert.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurant_id: 'rest-1',
        policy_hash: policyHash,
        active: true,
        created_by_user_id: 'user-1',
        activated_at: '2026-05-10T12:15:00.000Z',
      }),
    );
    expect(row.policyHash).toBe(policyHash);
    expect(row.active).toBe(true);
  });
});
