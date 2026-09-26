import { describe, expect, it, vi } from 'vitest';

import {
  BusinessContextStaleWriteError,
  BusinessContextValidationError,
  getRestaurantBusinessContext,
  updateRestaurantBusinessContext,
} from '@/server/restaurants/businessContext';

type RpcResult = { data: unknown; error: { code?: string; message?: string } | null };

/**
 * Minimal Supabase double: `rpc` is scripted per function name, and table reads resolve to empty
 * lists. Every `insert` is recorded so a test can prove nothing is written outside the RPC.
 */
function makeClient(rpcResults: Record<string, RpcResult | RpcResult[]>) {
  const inserts: Array<{ table: string; rows: unknown }> = [];
  const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const queues = new Map(
    Object.entries(rpcResults).map(([fn, result]) => [
      fn,
      Array.isArray(result) ? [...result] : [result],
    ]),
  );
  const rpc = vi.fn(async (fn: string, args: Record<string, unknown>) => {
    calls.push({ fn, args });
    const queue = queues.get(fn);
    if (!queue || queue.length === 0) {
      return { data: null, error: { code: 'PGRST202', message: `missing ${fn}` } };
    }
    return queue.length > 1 ? queue.shift() : queue[0];
  });

  class Query {
    constructor(private readonly table: string) {}
    select() {
      return this;
    }
    eq() {
      return this;
    }
    order() {
      return this;
    }
    insert(rows: unknown) {
      inserts.push({ table: this.table, rows });
      return Promise.resolve({ error: null });
    }
    then<T>(onfulfilled?: (value: { data: unknown[]; error: null }) => T) {
      return Promise.resolve({ data: [], error: null }).then(onfulfilled);
    }
  }

  const client = { rpc, from: (table: string) => new Query(table) };
  return {
    client: client as unknown as Parameters<typeof updateRestaurantBusinessContext>[2],
    rpc,
    calls,
    inserts,
  };
}

const provenance = {
  changeOrigin: 'owner' as const,
  changedByUserId: '00000000-0000-4000-8000-0000000000aa',
  changedVia: 'ops_business_context_api',
  changeReason: 'Owner/admin business-context update from ops settings.',
};

describe('updateRestaurantBusinessContext (single transaction)', () => {
  it('@contract sends every section and its change-log rows in one RPC call with the revision precondition', async () => {
    const { client, calls, inserts } = makeClient({
      replace_restaurant_business_context_v2: {
        data: { status: 'applied', revision: 8 },
        error: null,
      },
    });

    const snapshot = await updateRestaurantBusinessContext(
      'rest-1',
      {
        businessDetails: { businessStatus: 'open', isServiceAreaBusiness: true },
        categories: [{ displayName: 'Gastropub', isPrimary: true }],
        links: [{ linkType: 'website', url: 'https://example.com' }],
      },
      client,
      provenance,
      { expectedRevision: 7 },
    );

    const writes = calls.filter((call) => call.fn.startsWith('replace_'));
    expect(writes).toHaveLength(1);
    expect(writes[0]?.fn).toBe('replace_restaurant_business_context_v2');
    const args = writes[0]?.args ?? {};
    expect(args.p_restaurant_id).toBe('rest-1');
    expect(args.p_expected_revision).toBe(7);
    expect(args.p_business_details).toMatchObject({ is_service_area_business: true });
    expect(args.p_categories).toEqual([expect.objectContaining({ display_name: 'Gastropub' })]);
    expect(args.p_links).toEqual([expect.objectContaining({ url: 'https://example.com' })]);
    expect(args.p_service_areas).toBeNull();
    expect(args.p_change_log_rows).toEqual([
      expect.objectContaining({
        entity_table: 'restaurant_business_details',
        change_origin: 'owner',
        changed_via: 'ops_business_context_api',
      }),
      expect.objectContaining({ entity_table: 'restaurant_links' }),
      expect.objectContaining({ entity_table: 'restaurant_categories' }),
    ]);
    // The audit rows are part of the RPC transaction: nothing is inserted separately.
    expect(inserts).toEqual([]);
    expect(snapshot.revision).toBe(8);
  });

  it('@contract a stale revision raises a typed error and reads nothing back', async () => {
    const { client, calls } = makeClient({
      replace_restaurant_business_context_v2: {
        data: { status: 'stale', revision: 9 },
        error: null,
      },
    });

    const error = await updateRestaurantBusinessContext(
      'rest-1',
      { categories: [] },
      client,
      provenance,
      { expectedRevision: 7 },
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(BusinessContextStaleWriteError);
    expect((error as BusinessContextStaleWriteError).currentRevision).toBe(9);
    expect(calls.map((call) => call.fn)).toEqual(['replace_restaurant_business_context_v2']);
  });

  it('falls back to the core RPC and a separate change-log insert while the v2 RPC is not deployed', async () => {
    const { client, calls, inserts } = makeClient({
      replace_restaurant_business_context_core: { data: null, error: null },
    });

    const snapshot = await updateRestaurantBusinessContext(
      'rest-1',
      { categories: [{ displayName: 'Gastropub' }] },
      client,
      provenance,
      { expectedRevision: 3 },
    );

    expect(calls.map((call) => call.fn)).toEqual([
      'replace_restaurant_business_context_v2',
      'replace_restaurant_business_context_core',
      'get_restaurant_business_context_revision_v1',
    ]);
    expect(inserts.map((entry) => entry.table)).toEqual(['restaurant_profile_change_log']);
    expect(snapshot.revision).toBeUndefined();
  });

  it('propagates database errors from the v2 RPC unchanged for the route to classify', async () => {
    const dbError = { code: '23505', message: 'duplicate key value violates unique constraint' };
    const { client } = makeClient({
      replace_restaurant_business_context_v2: { data: null, error: dbError },
    });

    await expect(
      updateRestaurantBusinessContext('rest-1', { categories: [] }, client, provenance),
    ).rejects.toBe(dbError);
  });

  it.each([
    [
      { links: [{ linkType: 'website', url: '   ' }] },
      'links.0.url',
      /URL is required for website/,
    ],
    [
      {
        categories: [
          { displayName: 'A', isPrimary: true },
          { displayName: 'B', isPrimary: true },
        ],
      },
      'categories',
      /Only one business category can be marked as primary/,
    ],
    [
      { serviceAreas: [{ displayName: 'Cambridge', areaType: 'county' }] },
      'serviceAreas.0.areaType',
      /Service area type must be one of/,
    ],
    [
      { serviceAreas: [{ id: 'not-a-uuid', displayName: 'Cambridge' }] },
      'serviceAreas.0.id',
      /Service area id must be a valid UUID/,
    ],
    [
      { attributes: [{ attributeKey: 'has_wifi', valueType: 'unknown' }] },
      'attributes.0.valueType',
      /value type must be one of/,
    ],
  ] as const)(
    '@contract rejects invalid input with a field path before any write (%#)',
    async (input, field, message) => {
      const { client, rpc } = makeClient({});

      const error = await updateRestaurantBusinessContext(
        'rest-1',
        input as Parameters<typeof updateRestaurantBusinessContext>[1],
        client,
      ).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(BusinessContextValidationError);
      expect((error as BusinessContextValidationError).field).toBe(field);
      expect((error as Error).message).toMatch(message);
      expect(rpc).not.toHaveBeenCalled();
    },
  );
});

describe('getRestaurantBusinessContext revision', () => {
  it('@contract includes the stored revision so the editor can send it back', async () => {
    const { client } = makeClient({
      get_restaurant_business_context_revision_v1: { data: 12, error: null },
    });

    const snapshot = await getRestaurantBusinessContext('rest-1', client);

    expect(snapshot.revision).toBe(12);
  });

  it('omits the revision while the reader RPC is not deployed', async () => {
    const { client } = makeClient({});

    const snapshot = await getRestaurantBusinessContext('rest-1', client);

    expect(snapshot.revision).toBeUndefined();
    expect(snapshot.core.categories).toEqual([]);
  });
});
