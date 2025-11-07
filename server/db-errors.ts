import type { PostgrestError } from "@supabase/supabase-js";

export type ConstraintErrorKind =
  | "unique_conflict"
  | "overlap_conflict"
  | "fk_conflict"
  | "check_violation"
  | "unknown";

export type ConstraintErrorMapping = {
  kind: ConstraintErrorKind;
  userMessage: string;
  retryable: boolean;
};

function normalizeCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

function normalizeConstraint(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const constraint = (error as { constraint?: unknown }).constraint;
  return typeof constraint === "string" ? constraint : undefined;
}

export function mapDbErrorToConstraint(error: unknown): ConstraintErrorMapping | null {
  const code = normalizeCode(error);
  const constraint = normalizeConstraint(error);

  if (!code) return null;

  // Unique violations
  if (code === "23505") {
    // Booking slots, customers, table uniqueness, etc.
    if (constraint?.includes("booking_slots") || constraint?.includes("slot")) {
      return {
        kind: "unique_conflict",
        userMessage: "This time slot was just taken. Please pick another time.",
        retryable: false,
      };
    }

    if (constraint?.includes("customers") || constraint?.includes("email") || constraint?.includes("phone")) {
      return {
        kind: "unique_conflict",
        userMessage: "A customer with these contact details already exists.",
        retryable: false,
      };
    }

    return {
      kind: "unique_conflict",
      userMessage: "A conflicting record already exists.",
      retryable: false,
    };
  }

  // Exclusion violations (overlaps)
  if (code === "23P01") {
    return {
      kind: "overlap_conflict",
      userMessage: "This booking or hold conflicts with an existing allocation.",
      retryable: false,
    };
  }

  // Foreign key
  if (code === "23503") {
    return {
      kind: "fk_conflict",
      userMessage: "Related data required for this action is missing.",
      retryable: false,
    };
  }

  // Check violations
  if (code === "23514") {
    return {
      kind: "check_violation",
      userMessage: "This change violates a business rule. Please review the input values.",
      retryable: false,
    };
  }

  return {
    kind: "unknown",
    userMessage: "Unable to apply this change due to a database constraint.",
    retryable: false,
  };
}

export function isRetryableConstraintError(error: unknown): boolean {
  const code = normalizeCode(error);
  if (!code) return false;

  // Retriable categories: serialization failures, deadlocks, lock timeouts
  return code === "40001" || code === "40P01" || code === "55P03";
}

export function extractPostgrestError(error: unknown): PostgrestError | null {
  if (!error || typeof error !== "object") return null;
  const maybe = error as { message?: unknown; code?: unknown };
  if (typeof maybe.message === "string" && typeof maybe.code === "string") {
    return maybe as PostgrestError;
  }
  return null;
}
