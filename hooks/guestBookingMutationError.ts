import { HttpError } from '@/lib/http/errors';
import { toUserMessage } from '@/lib/http/userMessage';

/**
 * Guest copy for booking self-service failures. The guest edit/cancel dialogs
 * render `error.message`, so the hooks normalise it through toUserMessage:
 * known codes get this copy, other 4xx keep the (safe, C1) server message, and
 * 5xx/network failures get the generic copy.
 */
export const GUEST_BOOKING_ERROR_COPY: Partial<Record<string, string>> = {
  ACCESS_TOKEN_EXPIRED:
    'This booking link has expired. Request a new link from the booking page, then try again.',
  ACCESS_TOKEN_REVOKED:
    'This booking link is no longer valid. Request a new link from the booking page.',
  INVALID_ACCESS_TOKEN: 'This booking link is no longer valid. Request a new link.',
  UNAUTHENTICATED: 'Open the link from your booking email again, or sign in, to make changes.',
  ACCESS_TOKEN_IN_URL_REJECTED: 'Reload the booking page and try again.',
  CSRF_INVALID: 'Your session expired. Refresh the page and try again.',
  BOOKING_NOT_FOUND: 'We couldn’t find this booking.',
  CONTACT_CHANGE_NOT_ALLOWED:
    'Contact details can’t be changed online. Ask the venue to update them.',
  RATE_LIMITED: 'Too many changes in a short time. Wait a minute and try again.',
};

/** Rebuilds an HttpError with a user-presentable message; other errors pass through. */
export function toGuestBookingMutationError(error: unknown): unknown {
  if (!(error instanceof HttpError)) {
    return error;
  }
  return new HttpError({
    message: toUserMessage(error, { copy: GUEST_BOOKING_ERROR_COPY }),
    status: error.status,
    code: error.code,
    details: error.details,
    fields: error.fields,
    retryable: error.retryable,
    retryAfter: error.retryAfter,
    hasServerMessage: true,
    cause: error,
  });
}
