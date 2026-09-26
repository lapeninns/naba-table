/**
 * PLACEHOLDER (query-core agent): minimal implementation of the contract C2 signature so the
 * global mutation feedback compiles and is testable. The error-contract agent owns this file;
 * the integrator keeps that version and drops this one.
 */
import { HttpError } from '@/lib/http/errors';

export type UserMessageOptions = {
  copy?: Partial<Record<string, string>>;
  fallback?: string;
};

const DEFAULT_FALLBACK = 'Something went wrong. Please try again.';
const GENERIC_STATUS_MESSAGE = /^Request failed with status \d+$/;

function defaultCopyForStatus(status: number): string | null {
  if (status === 401) return 'Your session has expired. Please sign in again.';
  if (status === 403) return 'You do not have permission to do that.';
  if (status === 404) return 'We could not find that. It may have been removed.';
  if (status === 409) return 'This was changed elsewhere. Refresh and try again.';
  if (status === 429) return 'Too many attempts. Please wait a moment and try again.';
  if (status >= 500) return 'Something went wrong on our side. Please try again.';
  return null;
}

export function toUserMessage(error: unknown, opts: UserMessageOptions = {}): string {
  if (error instanceof HttpError) {
    const codeCopy = opts.copy?.[error.code];
    if (codeCopy) return codeCopy;
    const message = error.message.trim();
    if (
      error.status >= 400 &&
      error.status < 500 &&
      message.length > 0 &&
      !GENERIC_STATUS_MESSAGE.test(message)
    ) {
      return message;
    }
    return defaultCopyForStatus(error.status) ?? opts.fallback ?? DEFAULT_FALLBACK;
  }
  if (error instanceof TypeError) {
    return 'Check your connection and try again.';
  }
  return opts.fallback ?? DEFAULT_FALLBACK;
}
