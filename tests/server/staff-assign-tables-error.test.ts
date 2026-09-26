import { describe, expect, it } from 'vitest';

import { mapAssignTablesErrorToHttp } from '@/src/app/api/staff/_utils/assign-tables-error';
import { AssignTablesRpcError } from '@/server/capacity/holds';

const SECRET = 'duplicate key value violates unique constraint "booking_table_assignments_pkey"';

describe('mapAssignTablesErrorToHttp', () => {
  it('keeps status and code but never carries the RPC message, details or hint', () => {
    const { status, payload } = mapAssignTablesErrorToHttp(
      new AssignTablesRpcError({ message: SECRET, code: 'assignment_conflict', details: SECRET, hint: SECRET }),
    );

    expect(status).toBe(409);
    expect(payload.code).toBe('ASSIGNMENT_CONFLICT');
    expect(JSON.stringify(payload)).not.toContain('duplicate key');
    expect(payload).not.toHaveProperty('details');
    expect(payload).not.toHaveProperty('hint');
    expect(payload.message).toBe(payload.error);
  });

  it('maps validation codes to 422 and repository errors to 503 with generic copy', () => {
    expect(
      mapAssignTablesErrorToHttp(new AssignTablesRpcError({ message: SECRET, code: 'POLICY_DRIFT' })),
    ).toMatchObject({ status: 422, payload: { code: 'POLICY_DRIFT' } });
    const repository = mapAssignTablesErrorToHttp(
      new AssignTablesRpcError({ message: SECRET, code: 'ASSIGNMENT_REPOSITORY_ERROR' }),
    );
    expect(repository.status).toBe(503);
    expect(repository.payload.message).not.toContain('duplicate key');
  });
});
