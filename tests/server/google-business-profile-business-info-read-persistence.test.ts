import { describe, expect, it } from 'vitest';

import { readGoogleBusinessProfileBusinessInfo } from '@/server/google-business-profile/businessInfoReadPersistence';

class Query {
  constructor(
    private readonly table: string,
    private readonly errors: Record<string, unknown>,
  ) {}

  select() {
    return this;
  }

  eq() {
    return this;
  }

  order() {
    return this;
  }

  maybeSingle() {
    return Promise.resolve({ data: null, error: this.errors[this.table] ?? null });
  }

  then<TResult1 = { data: unknown[]; error: unknown }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: unknown[]; error: unknown }) => TResult1 | PromiseLike<TResult1>)
      | null,
    _onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve({
      data: [],
      error: this.errors[this.table] ?? null,
    }).then(onfulfilled);
  }
}

function createClient(errors: Record<string, unknown> = {}) {
  return {
    from(table: string) {
      return new Query(table, errors);
    },
  };
}

describe('google business profile business info read persistence', () => {
  it('treats a missing field-sync-status table as optional during reads', async () => {
    const result = await readGoogleBusinessProfileBusinessInfo(
      'rest-1',
      createClient({
        restaurant_field_sync_statuses: {
          code: 'PGRST205',
          message:
            "Could not find the table 'public.restaurant_field_sync_statuses' in the schema cache",
        },
      }) as never,
    );

    expect(result).toMatchObject({
      details: null,
      addresses: [],
      phoneNumbers: [],
      links: [],
      categories: [],
      serviceAreas: [],
      hours: [],
      attributes: [],
      serviceItems: [],
    });
  });

  it('throws non-optional field-sync-status errors', async () => {
    const error = {
      code: '42501',
      message: 'permission denied for table restaurant_field_sync_statuses',
    };

    await expect(
      readGoogleBusinessProfileBusinessInfo(
        'rest-1',
        createClient({
          restaurant_field_sync_statuses: error,
        }) as never,
      ),
    ).rejects.toBe(error);
  });

  it('throws provider table query errors', async () => {
    const error = {
      code: '42501',
      message: 'permission denied for table restaurant_addresses',
    };

    await expect(
      readGoogleBusinessProfileBusinessInfo(
        'rest-1',
        createClient({
          restaurant_addresses: error,
        }) as never,
      ),
    ).rejects.toBe(error);
  });
});
