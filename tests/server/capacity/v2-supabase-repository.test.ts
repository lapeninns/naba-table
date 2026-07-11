import { beforeEach, describe, expect, it, vi } from 'vitest';

const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

import {
  AssignmentConflictError,
  AssignmentRepositoryError,
  AssignmentValidationError,
} from '@/server/capacity/v2/errors';
import {
  NoopAssignmentRepository,
  SupabaseAssignmentRepository,
} from '@/server/capacity/v2/supabase-repository';

import type { AssignmentCommitRequest } from '@/server/capacity/v2/types';
import type { SupabaseClient } from '@supabase/supabase-js';

const TABLE_ID = 'AAAAAAAA-0000-4000-8000-000000000001';
const BLOCKING_BOOKING_ID = '123E4567-E89B-42D3-A456-426614174000';
const OTHER_TABLE_ID = 'bbbbbbbb-0000-4000-8000-000000000002';

function makeRequest(
  overrides: Partial<AssignmentCommitRequest> = {},
): AssignmentCommitRequest {
  return {
    context: {
      bookingId: 'booking-1',
      restaurantId: 'rest-1',
      partySize: 4,
      window: { startAt: '2026-07-11T18:00:00Z', endAt: '2026-07-11T20:00:00Z' },
    },
    plan: {
      signature: 'sig-123',
      tableIds: [TABLE_ID],
      startAt: '2026-07-11T18:00:00Z',
      endAt: '2026-07-11T20:00:00Z',
    },
    source: 'auto',
    idempotencyKey: 'idem-1',
    ...overrides,
  };
}

function makeRepo(rpcResult: { data?: unknown; error?: unknown }) {
  const rpc = vi.fn().mockResolvedValue({ data: null, error: null, ...rpcResult });
  const repo = new SupabaseAssignmentRepository({ rpc } as unknown as SupabaseClient);
  return { repo, rpc };
}

async function captureError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('expected the commit to reject');
}

describe('SupabaseAssignmentRepository', () => {
  beforeEach(() => {
    getServiceSupabaseClientMock.mockReset();
  });

  it('@contract commits through assign_tables_atomic_v2 and maps the returned rows', async () => {
    const { repo, rpc } = makeRepo({
      data: [
        {
          table_id: 'table-a',
          start_at: '2026-07-11T18:00:00Z',
          end_at: '2026-07-11T20:00:00Z',
          merge_group_id: 'mg-1',
          assignment_id: 'assign-1',
        },
        {
          table_id: 'table-b',
          start_at: '2026-07-11T18:00:00Z',
          end_at: '2026-07-11T20:00:00Z',
          merge_group_id: null,
        },
      ],
    });

    const response = await repo.commitAssignment(makeRequest());

    expect(rpc).toHaveBeenCalledWith('assign_tables_atomic_v2', {
      p_booking_id: 'booking-1',
      p_table_ids: [TABLE_ID],
      p_idempotency_key: 'idem-1',
      p_require_adjacency: true, // default
      p_assigned_by: null, // default
      p_start_at: '2026-07-11T18:00:00Z',
      p_end_at: '2026-07-11T20:00:00Z',
    });
    expect(response).toEqual({
      attemptId: 'rpc-sig-123',
      assignments: [
        {
          tableId: 'table-a',
          startAt: '2026-07-11T18:00:00Z',
          endAt: '2026-07-11T20:00:00Z',
          mergeGroupId: 'mg-1',
          assignmentId: 'assign-1',
        },
        {
          tableId: 'table-b',
          startAt: '2026-07-11T18:00:00Z',
          endAt: '2026-07-11T20:00:00Z',
          mergeGroupId: null,
          assignmentId: undefined,
        },
      ],
      mergeGroupId: 'mg-1', // taken from the first row
      shadow: false,
    });
  });

  it('@contract honours explicit requireAdjacency=false, actorId and shadow flags', async () => {
    const { repo, rpc } = makeRepo({ data: [] });

    const response = await repo.commitAssignment(
      makeRequest({ requireAdjacency: false, actorId: 'user-9', shadow: true }),
    );

    expect(rpc).toHaveBeenCalledWith(
      'assign_tables_atomic_v2',
      expect.objectContaining({ p_require_adjacency: false, p_assigned_by: 'user-9' }),
    );
    expect(response.shadow).toBe(true);
  });

  it('@contract null RPC data maps to an empty assignment set', async () => {
    const { repo } = makeRepo({ data: null });

    const response = await repo.commitAssignment(makeRequest());

    expect(response.assignments).toEqual([]);
    expect(response.mergeGroupId).toBeNull();
  });

  it('@contract rejects before touching the RPC when the context window is missing', async () => {
    const { repo, rpc } = makeRepo({ data: [] });
    const request = makeRequest();
    request.context = { ...request.context, window: undefined };

    const error = await captureError(repo.commitAssignment(request));

    expect(error).toBeInstanceOf(AssignmentValidationError);
    expect((error as AssignmentValidationError).message).toBe(
      'Assignment window not provided in context',
    );
    expect(rpc).not.toHaveBeenCalled();
  });

  it('@contract translates unique-violation conflicts, extracting lowercased table and booking uuids', async () => {
    const { repo } = makeRepo({
      error: {
        code: '23505',
        message: `assignment overlaps booking ${BLOCKING_BOOKING_ID}`,
        details: `conflicting table ${OTHER_TABLE_ID}`,
        hint: 'retry later',
      },
    });

    const error = (await captureError(
      repo.commitAssignment(makeRequest()),
    )) as AssignmentConflictError;

    expect(error).toBeInstanceOf(AssignmentConflictError);
    expect(error.details?.tableIds).toEqual(
      expect.arrayContaining([
        TABLE_ID.toLowerCase(),
        BLOCKING_BOOKING_ID.toLowerCase(), // every uuid in the message is surfaced
        OTHER_TABLE_ID,
      ]),
    );
    expect(error.details?.blockingBookingId).toBe(BLOCKING_BOOKING_ID.toLowerCase());
    expect(error.details?.window).toEqual({
      start: '2026-07-11T18:00:00Z',
      end: '2026-07-11T20:00:00Z',
    });
    expect(error.details?.hint).toBe('retry later');
  });

  it('@contract maps capacity_exceeded_post_assignment to a conflict with a remediation hint', async () => {
    const { repo } = makeRepo({
      error: {
        code: 'P0001',
        message: 'capacity_exceeded_post_assignment for zone main',
        details: null,
        hint: null,
      },
    });

    const error = (await captureError(
      repo.commitAssignment(makeRequest()),
    )) as AssignmentConflictError;

    expect(error).toBeInstanceOf(AssignmentConflictError);
    expect(error.message).toBe('Capacity exceeded after assignment');
    expect(error.details?.hint).toBe(
      'Release tables or adjust capacity overrides before retrying.',
    );
  });

  it('@contract maps constraint codes and validation phrases to AssignmentValidationError', async () => {
    const byCode = makeRepo({
      error: { code: '23514', message: 'new row violates check constraint', details: 'd', hint: 'h' },
    });
    const codeError = (await captureError(
      byCode.repo.commitAssignment(makeRequest()),
    )) as AssignmentValidationError;
    expect(codeError).toBeInstanceOf(AssignmentValidationError);
    expect(codeError.details).toMatchObject({
      code: '23514',
      plan: {
        tableIds: [TABLE_ID],
        startAt: '2026-07-11T18:00:00Z',
        endAt: '2026-07-11T20:00:00Z',
      },
      context: { bookingId: 'booking-1', restaurantId: 'rest-1' },
    });

    const byPhrase = makeRepo({
      error: { code: undefined, message: 'plan requires at least one table' },
    });
    const phraseError = await captureError(byPhrase.repo.commitAssignment(makeRequest()));
    expect(phraseError).toBeInstanceOf(AssignmentValidationError);
  });

  it('@contract conflict keywords win over validation keywords when both appear', async () => {
    const { repo } = makeRepo({
      error: { message: 'invalid adjacency causes overlap conflict' },
    });

    const error = await captureError(repo.commitAssignment(makeRequest()));

    expect(error).toBeInstanceOf(AssignmentConflictError);
  });

  it('@contract wraps unrecognised failures as AssignmentRepositoryError with the raw cause', async () => {
    const raw = { code: 'XX000', message: 'weird failure' };
    const { repo } = makeRepo({ error: raw });
    const error = (await captureError(
      repo.commitAssignment(makeRequest()),
    )) as AssignmentRepositoryError;
    expect(error).toBeInstanceOf(AssignmentRepositoryError);
    expect(error.message).toBe('weird failure');
    expect(error.cause).toBe(raw);

    // An entirely empty error object still produces the generic message.
    const empty = makeRepo({ error: {} });
    const emptyError = await captureError(empty.repo.commitAssignment(makeRequest()));
    expect(emptyError).toBeInstanceOf(AssignmentRepositoryError);
    expect((emptyError as Error).message).toBe('assign_tables_atomic_v2 failed');
  });

  it('@contract NoopAssignmentRepository returns an inert shadow response', async () => {
    const response = await new NoopAssignmentRepository().commitAssignment(makeRequest());

    expect(response).toEqual({
      attemptId: 'noop',
      assignments: [],
      mergeGroupId: null,
      shadow: true,
    });
  });
});
