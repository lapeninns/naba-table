import type { AssignTablesRpcError } from '@/server/capacity/holds';

const VALIDATION_CODES = new Set<string>([
  'POLICY_DRIFT',
  'HOLD_METADATA_INCOMPLETE',
  'HOLD_BOOKING_MISMATCH',
  'HOLD_RESTAURANT_MISMATCH',
  'HOLD_EMPTY',
  'ASSIGNMENT_VALIDATION',
  'ASSIGNMENT_EMPTY',
  'RPC_VALIDATION',
  'POLICY_REQUOTE_FAILED',
  'POLICY_RETRY_FAILED',
]);

const SERVER_ERROR_CODES = new Map<string, number>([
  ['ASSIGNMENT_REPOSITORY_ERROR', 503],
  ['HOLD_LOOKUP_FAILED', 500],
]);

const GENERIC_MESSAGE_BY_STATUS: Record<number, string> = {
  409: 'Those tables are no longer available for this booking.',
  422: 'Those tables cannot be assigned to this booking.',
  500: 'Tables could not be assigned. Try again.',
  503: 'Tables could not be assigned. Try again.',
};

/**
 * Maps an AssignTablesRpcError to an HTTP status and a C1-safe payload. The RPC error's
 * message, details and hint can carry Postgres or repository text, so none of them is
 * carried: only the normalized code and fixed copy for the status.
 */
export function mapAssignTablesErrorToHttp(error: AssignTablesRpcError): {
  status: number;
  payload: { message: string; error: string; code: string };
} {
  const code = (error.code ?? 'ASSIGNMENT_ERROR').toUpperCase();
  const status = SERVER_ERROR_CODES.get(code) ?? (VALIDATION_CODES.has(code) ? 422 : 409);
  const message = GENERIC_MESSAGE_BY_STATUS[status] ?? 'Tables could not be assigned.';
  return {
    status,
    payload: { message, error: message, code },
  };
}
