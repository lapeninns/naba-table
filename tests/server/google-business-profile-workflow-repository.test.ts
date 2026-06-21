import { describe, expect, it, vi } from 'vitest';

import {
  claimPublishJobForGoogleRetry,
  insertPublishEvent,
  isUniqueConstraintError,
  readLatestDraft,
  upsertPublishJobFromPreflight,
  type WorkflowPublishJobPreflightContext,
} from '@/server/google-business-profile/workflowRepository';

function buildPreflightContext(
  overrides: Partial<WorkflowPublishJobPreflightContext> = {},
): WorkflowPublishJobPreflightContext {
  return {
    draft: { id: 'draft-1' },
    externalProfile: { id: 'external-1' },
    mode: 'google_only',
    directionIntent: 'nabatable_to_google',
    selectedApprovals: { 'profile.name': true },
    decisions: [],
    sections: ['profile'],
    nabatableUpdates: [],
    googleUpdates: [],
    pullOnlyItems: [],
    googleUpdateMasks: ['title'],
    warnings: [],
    errors: [],
    idempotencyKey: 'gbp-publish:rest-1:draft-1:hash',
    ...overrides,
  };
}

function createMaybeSingleClient(results: Array<{ data: unknown; error: unknown }>) {
  const filters: Array<{ column: string; value: unknown }> = [];
  const maybeSingle = vi.fn();
  for (const result of results) {
    maybeSingle.mockResolvedValueOnce(result);
  }
  const builder = {
    eq: vi.fn((column: string, value: unknown) => {
      filters.push({ column, value });
      return builder;
    }),
    limit: vi.fn(() => builder),
    maybeSingle,
    order: vi.fn(() => builder),
    select: vi.fn(() => builder),
  };
  const from = vi.fn(() => builder);

  return {
    builder,
    client: { from },
    filters,
    from,
    maybeSingle,
  };
}

function createInsertClient(result: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(result);
  const insertBuilder = {
    select: vi.fn(() => insertBuilder),
    single,
  };
  const insert = vi.fn(() => insertBuilder);
  const from = vi.fn(() => ({ insert }));

  return {
    client: { from },
    from,
    insert,
    single,
  };
}

function createUpsertClient(input: {
  existingResult: { data: unknown; error: unknown };
  insertResult: { data: unknown; error: unknown };
  racedResult?: { data: unknown; error: unknown };
}) {
  const filters: Array<{ column: string; value: unknown }> = [];
  const maybeSingle = vi.fn().mockResolvedValueOnce(input.existingResult);
  if (input.racedResult) {
    maybeSingle.mockResolvedValueOnce(input.racedResult);
  }
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

describe('google business profile workflow repository', () => {
  it('detects database unique-constraint errors from codes and messages', () => {
    expect(isUniqueConstraintError({ code: '23505' })).toBe(true);
    expect(
      isUniqueConstraintError({ message: 'duplicate key value violates unique constraint' }),
    ).toBe(true);
    expect(isUniqueConstraintError({ details: 'Unique constraint failed' })).toBe(true);
    expect(isUniqueConstraintError({ code: 'PGRST116' })).toBe(false);
  });

  it('inserts publish events with provider, direction, values, and pending result', async () => {
    const insertedEvent = { id: 'event-1' };
    const { client, from, insert } = createInsertClient({
      data: insertedEvent,
      error: null,
    });

    const result = await insertPublishEvent({
      restaurantId: 'rest-1',
      draftId: 'draft-1',
      externalProfileId: 'external-1',
      direction: 'push_from_nabatable_to_google',
      sections: ['profile'],
      oldValues: { name: 'Old' },
      newValues: { name: 'New' },
      googleUpdateMasks: ['title'],
      actorUserId: 'user-1',
      client: client as never,
    });

    expect(result).toBe(insertedEvent);
    expect(from).toHaveBeenCalledWith('restaurant_external_profile_publish_events');
    expect(insert).toHaveBeenCalledWith({
      restaurant_id: 'rest-1',
      draft_id: 'draft-1',
      external_profile_id: 'external-1',
      provider: 'google_business_profile',
      direction: 'push_from_nabatable_to_google',
      affected_sections: ['profile'],
      old_values: { name: 'Old' },
      new_values: { name: 'New' },
      google_update_masks: ['title'],
      result: 'pending',
      errors: [],
      actor_user_id: 'user-1',
    });
  });

  it('upserts publish jobs from preflight context when no idempotent job exists', async () => {
    const insertedJob = { id: 'job-1', status: 'preflight_ready' };
    const { client, filters, from, insert } = createUpsertClient({
      existingResult: { data: null, error: null },
      insertResult: { data: insertedJob, error: null },
    });

    const result = await upsertPublishJobFromPreflight({
      restaurantId: 'rest-1',
      actorUserId: 'user-1',
      context: buildPreflightContext(),
      client: client as never,
    });

    expect(result).toBe(insertedJob);
    expect(from).toHaveBeenCalledWith('restaurant_external_profile_publish_jobs');
    expect(filters).toEqual([
      {
        column: 'idempotency_key',
        value: 'gbp-publish:rest-1:draft-1:hash',
      },
    ]);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurant_id: 'rest-1',
        draft_id: 'draft-1',
        external_profile_id: 'external-1',
        provider: 'google_business_profile',
        idempotency_key: 'gbp-publish:rest-1:draft-1:hash',
        mode: 'google_only',
        status: 'preflight_ready',
        selected_approvals: { 'profile.name': true },
        nabatable_sections: ['profile'],
        google_update_masks: ['title'],
        created_by_user_id: 'user-1',
      }),
    );
  });

  it('returns a raced idempotent job after a duplicate insert error', async () => {
    const racedJob = { id: 'job-raced', status: 'preflight_ready' };
    const { client, maybeSingle } = createUpsertClient({
      existingResult: { data: null, error: null },
      insertResult: {
        data: null,
        error: { code: '23505', message: 'duplicate key value violates unique constraint' },
      },
      racedResult: { data: racedJob, error: null },
    });

    const result = await upsertPublishJobFromPreflight({
      restaurantId: 'rest-1',
      actorUserId: 'user-1',
      context: buildPreflightContext(),
      client: client as never,
    });

    expect(result).toBe(racedJob);
    expect(maybeSingle).toHaveBeenCalledTimes(2);
  });

  it('claims Google retry jobs through a retryable-status compare-and-set', async () => {
    const claimedJob = { id: 'job-1', status: 'publishing' };
    const filters: Array<{ column: string; operator: 'eq' | 'in'; value: unknown }> = [];
    const maybeSingle = vi.fn().mockResolvedValue({ data: claimedJob, error: null });
    const builder = {
      eq: vi.fn((column: string, value: unknown) => {
        filters.push({ column, operator: 'eq', value });
        return builder;
      }),
      in: vi.fn((column: string, value: unknown) => {
        filters.push({ column, operator: 'in', value });
        return builder;
      }),
      maybeSingle,
      select: vi.fn(() => builder),
    };
    const update = vi.fn(() => builder);
    const from = vi.fn(() => ({ update }));

    const result = await claimPublishJobForGoogleRetry({
      jobId: 'job-1',
      actorUserId: 'user-1',
      client: { from } as never,
    });

    expect(result).toBe(claimedJob);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'publishing',
        google_retry_by_user_id: 'user-1',
      }),
    );
    expect(filters).toEqual([
      { column: 'id', operator: 'eq', value: 'job-1' },
      {
        column: 'status',
        operator: 'in',
        value: ['google_failed', 'partially_published'],
      },
    ]);
  });

  it('reads the latest draft through provider-scoped ordering', async () => {
    const latestDraft = { id: 'draft-1' };
    const { client, builder, filters } = createMaybeSingleClient([
      { data: latestDraft, error: null },
    ]);

    const result = await readLatestDraft('rest-1', client as never);

    expect(result).toBe(latestDraft);
    expect(filters).toEqual([
      { column: 'restaurant_id', value: 'rest-1' },
      { column: 'provider', value: 'google_business_profile' },
    ]);
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(builder.limit).toHaveBeenCalledWith(1);
  });
});
