/**
 * Domain errors for canonical menu hierarchy writes. The repository converts known Postgres /
 * PostgREST failures into these kinds; routes map kinds to C1 responses. Database message text
 * is never forwarded to clients.
 */
export type MenuHierarchyErrorKind =
  | 'not_found'
  | 'duplicate'
  | 'order_stale'
  | 'idempotency_key_reused'
  | 'invalid_argument';

export class MenuHierarchyError extends Error {
  readonly kind: MenuHierarchyErrorKind;

  constructor(kind: MenuHierarchyErrorKind, options?: { cause?: unknown }) {
    super(`menu hierarchy ${kind}`, options);
    this.name = 'MenuHierarchyError';
    this.kind = kind;
  }
}

type DbErrorLike = { code?: unknown; message?: unknown };

function readDbError(error: unknown): { code: string; message: string } | null {
  if (!error || typeof error !== 'object') return null;
  const { code, message } = error as DbErrorLike;
  if (typeof code !== 'string') return null;
  return { code, message: typeof message === 'string' ? message : '' };
}

/** Messages raised by the pre-existing delete RPCs (20260531085500) with SQLSTATE P0001. */
const LEGACY_NOT_FOUND_MESSAGES = new Set([
  'Menu section not found for hierarchy delete',
  'Menu not found for hierarchy delete',
]);

function kindFor(code: string, message: string): MenuHierarchyErrorKind | null {
  switch (code) {
    case 'P0002': // menu_not_found | menu_section_not_found | menu_item_not_found
    case 'PGRST116': // .single() matched no row in the caller's restaurant scope
    case '22P02': // malformed uuid in a route parameter: nothing can match
      return 'not_found';
    case '23505':
      return 'duplicate';
    case '22023': // menu_invalid_argument
    case '23514': // check constraint (for example the label shape check)
      return 'invalid_argument';
    case 'P0001':
      if (message === 'menu_order_stale') return 'order_stale';
      if (message === 'menu_idempotency_key_reused') return 'idempotency_key_reused';
      if (LEGACY_NOT_FOUND_MESSAGES.has(message)) return 'not_found';
      return null;
    default:
      return null;
  }
}

/** Returns a MenuHierarchyError for known database failures, otherwise the original error. */
export function toMenuHierarchyError(error: unknown): unknown {
  if (error instanceof MenuHierarchyError) return error;
  const dbError = readDbError(error);
  if (!dbError) return error;
  const kind = kindFor(dbError.code, dbError.message);
  return kind ? new MenuHierarchyError(kind, { cause: error }) : error;
}
