import type { AssignTablesRpcError } from "@/server/capacity/holds";

const VALIDATION_CODES = new Set<string>([
  "POLICY_DRIFT",
  "HOLD_METADATA_INCOMPLETE",
  "HOLD_BOOKING_MISMATCH",
  "HOLD_RESTAURANT_MISMATCH",
  "HOLD_EMPTY",
  "ASSIGNMENT_VALIDATION",
  "ASSIGNMENT_EMPTY",
  "RPC_VALIDATION",
  "POLICY_REQUOTE_FAILED",
  "POLICY_RETRY_FAILED",
]);

const SERVER_ERROR_CODES = new Map<string, number>([
  ["ASSIGNMENT_REPOSITORY_ERROR", 503],
  ["HOLD_LOOKUP_FAILED", 500],
]);

export function mapAssignTablesErrorToHttp(error: AssignTablesRpcError): {
  status: number;
  payload: { message: string; error: string; code: string; details: string | null; hint: string | null };
} {
  const code = (error.code ?? "ASSIGNMENT_ERROR").toUpperCase();
  const status = SERVER_ERROR_CODES.get(code) ?? (VALIDATION_CODES.has(code) ? 422 : 409);
  return {
    status,
    payload: {
      message: error.message,
      error: error.message,
      code,
      details: error.details ?? null,
      hint: error.hint ?? null,
    },
  };
}
