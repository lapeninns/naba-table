import { describe, expect, it, vi } from 'vitest';

const repositoryWarnMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/logger', () => ({
  logger: {
    child: vi.fn(() => ({
      warn: repositoryWarnMock,
    })),
  },
}));

import {
  deleteCredentialsForExternalProfile,
  ensureExternalProfile,
  findExternalProfile,
  getCredentialRow,
  insertOAuthState,
  markOAuthStateConsumed,
  readOAuthStateByToken,
  recordSyncRun,
  updateCredentialRefresh,
  updateExternalProfile,
  upsertCredential,
} from '@/server/google-business-profile/serviceRepository';

function createExternalProfileReadClient(result: { data: unknown; error: unknown }) {
  const filters: Array<{ column: string; value: unknown }> = [];
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const builder = {
    eq: vi.fn((column: string, value: unknown) => {
      filters.push({ column, value });
      return builder;
    }),
    maybeSingle,
    select: vi.fn(() => builder),
  };
  const from = vi.fn(() => builder);

  return {
    client: { from },
    filters,
    from,
    maybeSingle,
  };
}

function createEnsureExternalProfileInsertClient(input: {
  readResult: { data: unknown; error: unknown };
  insertResult: { data: unknown; error: unknown };
}) {
  const filters: Array<{ column: string; value: unknown }> = [];
  const maybeSingle = vi.fn().mockResolvedValue(input.readResult);
  const readBuilder = {
    eq: vi.fn((column: string, value: unknown) => {
      filters.push({ column, value });
      return readBuilder;
    }),
    maybeSingle,
    select: vi.fn(() => readBuilder),
  };
  const single = vi.fn().mockResolvedValue(input.insertResult);
  const insertBuilder = {
    select: vi.fn(() => insertBuilder),
    single,
  };
  const insert = vi.fn(() => insertBuilder);
  const from = vi.fn(() => ({
    eq: readBuilder.eq,
    insert,
    maybeSingle: readBuilder.maybeSingle,
    select: readBuilder.select,
  }));

  return {
    client: { from },
    filters,
    from,
    insert,
    maybeSingle,
    single,
  };
}

function createCredentialReadClient(result: { data: unknown; error: unknown }) {
  const filters: Array<{ column: string; value: unknown }> = [];
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const builder = {
    eq: vi.fn((column: string, value: unknown) => {
      filters.push({ column, value });
      return builder;
    }),
    maybeSingle,
    select: vi.fn(() => builder),
  };
  const from = vi.fn(() => builder);

  return {
    client: { from },
    filters,
    from,
    maybeSingle,
  };
}

function createMutationClient(tableResult: { error: unknown }) {
  const insert = vi.fn().mockResolvedValue(tableResult);
  const upsert = vi.fn().mockResolvedValue(tableResult);
  const from = vi.fn(() => ({ insert, upsert }));

  return {
    client: { from },
    from,
    insert,
    upsert,
  };
}

function createFilteredMutationClient(method: 'delete' | 'update', result: { error: unknown }) {
  const filters: Array<{ column: string; value: unknown }> = [];
  const builder = {
    eq: vi.fn(async (column: string, value: unknown) => {
      filters.push({ column, value });
      return result;
    }),
  };
  const mutation = vi.fn(() => builder);
  const from = vi.fn(() => ({ [method]: mutation }));

  return {
    client: { from },
    filters,
    from,
    mutation,
  };
}

function createOAuthStateReadClient(result: { data: unknown; error: unknown }) {
  const filters: Array<{ column: string; value: unknown }> = [];
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const builder = {
    eq: vi.fn((column: string, value: unknown) => {
      filters.push({ column, value });
      return builder;
    }),
    maybeSingle,
    select: vi.fn(() => builder),
  };
  const from = vi.fn(() => builder);

  return {
    client: { from },
    filters,
    from,
  };
}

function createOAuthStateConsumeClient(result: { data: unknown; error: unknown }) {
  const filters: Array<{ column: string; operator: 'eq' | 'is'; value: unknown }> = [];
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const builder = {
    eq: vi.fn((column: string, value: unknown) => {
      filters.push({ column, operator: 'eq', value });
      return builder;
    }),
    is: vi.fn((column: string, value: unknown) => {
      filters.push({ column, operator: 'is', value });
      return builder;
    }),
    maybeSingle,
    select: vi.fn(() => builder),
  };
  const update = vi.fn(() => builder);
  const from = vi.fn(() => ({ update }));

  return {
    client: { from },
    filters,
    from,
    update,
  };
}

describe('google business profile service repository', () => {
  it('finds external profiles with restaurant and provider filters', async () => {
    const externalProfile = { id: 'external-1' };
    const { client, filters, from } = createExternalProfileReadClient({
      data: externalProfile,
      error: null,
    });

    await expect(findExternalProfile('rest-1', client as never)).resolves.toBe(externalProfile);

    expect(from).toHaveBeenCalledWith('restaurant_external_profiles');
    expect(filters).toEqual([
      { column: 'restaurant_id', value: 'rest-1' },
      { column: 'provider', value: 'google_business_profile' },
    ]);
  });

  it('ensures a new external profile with the GBP provider when none exists', async () => {
    const insertedProfile = { id: 'external-1', connection_status: 'unlinked' };
    const { client, insert } = createEnsureExternalProfileInsertClient({
      readResult: { data: null, error: null },
      insertResult: { data: insertedProfile, error: null },
    });

    await expect(ensureExternalProfile('rest-1', client as never)).resolves.toBe(insertedProfile);

    expect(insert).toHaveBeenCalledWith({
      restaurant_id: 'rest-1',
      provider: 'google_business_profile',
      connection_status: 'unlinked',
    });
  });

  it('returns an existing external profile without inserting', async () => {
    const externalProfile = { id: 'external-existing' };
    const { client, insert } = createEnsureExternalProfileInsertClient({
      readResult: { data: externalProfile, error: null },
      insertResult: { data: { id: 'unused' }, error: null },
    });

    await expect(ensureExternalProfile('rest-1', client as never)).resolves.toBe(externalProfile);
    expect(insert).not.toHaveBeenCalled();
  });

  it('reads credentials by external profile id', async () => {
    const credential = { id: 'credential-1' };
    const { client, filters, from } = createCredentialReadClient({
      data: credential,
      error: null,
    });

    await expect(getCredentialRow('external-1', client as never)).resolves.toBe(credential);

    expect(from).toHaveBeenCalledWith('restaurant_external_profile_credentials');
    expect(filters).toEqual([{ column: 'external_profile_id', value: 'external-1' }]);
  });

  it('upserts credential payloads without changing the payload shape', async () => {
    const { client, from, upsert } = createMutationClient({ error: null });
    const payload = {
      external_profile_id: 'external-1',
      provider_user_id: 'google-user-1',
      connected_google_email: 'owner@example.com',
      connected_google_name: 'Owner',
      refresh_token_encrypted: 'encrypted-refresh',
      granted_scopes: ['scope-a'],
      token_type: 'Bearer',
      last_refreshed_at: '2026-05-21T22:00:00.000Z',
      last_error: null,
    };

    await expect(upsertCredential(payload, client as never)).resolves.toBe(undefined);

    expect(from).toHaveBeenCalledWith('restaurant_external_profile_credentials');
    expect(upsert).toHaveBeenCalledWith(payload);
  });

  it('updates credential refresh values through the external profile id filter', async () => {
    const { client, filters, from, mutation } = createFilteredMutationClient('update', {
      error: null,
    });
    const payload = {
      refresh_token_encrypted: 'encrypted-refresh',
      granted_scopes: ['scope-a'],
      token_type: 'Bearer',
      last_refreshed_at: '2026-05-21T22:00:00.000Z',
      last_error: null,
    };

    await expect(updateCredentialRefresh('external-1', payload, client as never)).resolves.toBe(
      undefined,
    );

    expect(from).toHaveBeenCalledWith('restaurant_external_profile_credentials');
    expect(mutation).toHaveBeenCalledWith(payload);
    expect(filters).toEqual([{ column: 'external_profile_id', value: 'external-1' }]);
  });

  it('deletes credentials through the external profile id filter', async () => {
    const { client, filters, from, mutation } = createFilteredMutationClient('delete', {
      error: null,
    });

    await expect(deleteCredentialsForExternalProfile('external-1', client as never)).resolves.toBe(
      undefined,
    );

    expect(from).toHaveBeenCalledWith('restaurant_external_profile_credentials');
    expect(mutation).toHaveBeenCalledWith();
    expect(filters).toEqual([{ column: 'external_profile_id', value: 'external-1' }]);
  });

  it('updates external profiles through an id filter', async () => {
    const filters: Array<{ column: string; value: unknown }> = [];
    const result = { error: null };
    const updateBuilder = {
      eq: vi.fn(async (column: string, value: unknown) => {
        filters.push({ column, value });
        return result;
      }),
    };
    const update = vi.fn(() => updateBuilder);
    const from = vi.fn(() => ({ update }));
    const client = { from };
    const payload = { last_error: null, connection_status: 'linked' };

    await expect(updateExternalProfile('external-1', payload, client as never)).resolves.toBe(
      undefined,
    );

    expect(from).toHaveBeenCalledWith('restaurant_external_profiles');
    expect(update).toHaveBeenCalledWith(payload);
    expect(filters).toEqual([{ column: 'id', value: 'external-1' }]);
  });

  it('records sync-run audit failures as warnings without throwing', async () => {
    repositoryWarnMock.mockClear();
    const insertError = new Error('audit insert failed');
    const insert = vi.fn().mockResolvedValue({ error: insertError });
    const from = vi.fn(() => ({ insert }));
    const client = { from };
    const payload = {
      external_profile_id: 'external-1',
      restaurant_id: 'rest-1',
      provider: 'google_business_profile',
      run_kind: 'manual',
      status: 'failed',
      started_at: '2026-05-21T22:00:00.000Z',
      finished_at: '2026-05-21T22:01:00.000Z',
      error_code: 'GBP_FORBIDDEN',
      error_message: 'Forbidden',
      metadata: null,
    };

    await expect(recordSyncRun(payload, client as never)).resolves.toBe(undefined);

    expect(from).toHaveBeenCalledWith('restaurant_external_profile_sync_runs');
    expect(insert).toHaveBeenCalledWith(payload);
    expect(repositoryWarnMock).toHaveBeenCalledWith('sync run audit insert failed', {
      error: insertError,
    });
  });

  it('inserts OAuth state payloads without changing the payload shape', async () => {
    const { client, from, insert } = createMutationClient({ error: null });
    const payload = {
      restaurant_id: 'rest-1',
      provider: 'google_business_profile',
      requested_by_user_id: 'user-1',
      state_token: 'state-token',
      return_path: '/app/settings/restaurant/google-business-profile',
      expires_at: '2026-05-21T22:15:00.000Z',
    };

    await expect(insertOAuthState(payload, client as never)).resolves.toBe(undefined);

    expect(from).toHaveBeenCalledWith('restaurant_external_profile_oauth_states');
    expect(insert).toHaveBeenCalledWith(payload);
  });

  it('reads OAuth state records by state token', async () => {
    const state = { id: 'state-1', state_token: 'state-token' };
    const { client, filters, from } = createOAuthStateReadClient({
      data: state,
      error: null,
    });

    await expect(readOAuthStateByToken('state-token', client as never)).resolves.toBe(state);

    expect(from).toHaveBeenCalledWith('restaurant_external_profile_oauth_states');
    expect(filters).toEqual([{ column: 'state_token', value: 'state-token' }]);
  });

  it('marks OAuth state consumed with a consumed_at compare-and-set filter', async () => {
    const { client, filters, from, update } = createOAuthStateConsumeClient({
      data: { id: 'state-1' },
      error: null,
    });
    const payload = { consumed_at: '2026-05-21T22:00:00.000Z' };

    await expect(
      markOAuthStateConsumed({ stateId: 'state-1', payload }, client as never),
    ).resolves.toBe(true);

    expect(from).toHaveBeenCalledWith('restaurant_external_profile_oauth_states');
    expect(update).toHaveBeenCalledWith(payload);
    expect(filters).toEqual([
      { column: 'id', operator: 'eq', value: 'state-1' },
      { column: 'consumed_at', operator: 'is', value: null },
    ]);
  });

  it('returns false when no OAuth state row is consumed', async () => {
    const { client } = createOAuthStateConsumeClient({
      data: null,
      error: null,
    });

    await expect(
      markOAuthStateConsumed(
        { stateId: 'state-1', payload: { consumed_at: '2026-05-21T22:00:00.000Z' } },
        client as never,
      ),
    ).resolves.toBe(false);
  });
});
