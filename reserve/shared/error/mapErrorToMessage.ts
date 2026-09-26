import { HttpError } from '@/lib/http/errors';
import { toUserMessage } from '@/lib/http/userMessage';

const ERROR_CODE_MESSAGES: Record<string, string> = {
  CAPACITY_EXCEEDED: 'No tables are available at that time. Please choose another slot.',
  CAPACITY_UNAVAILABLE: 'We cannot confirm availability right now. Please try again in a moment.',
  DUPLICATE_RESOURCE:
    'Your email or phone number matches a previous guest, but not both. Please book with the same email address and phone number you used before, or call the restaurant for help.',
  INTERNAL: 'We could not complete your booking right now. Please try again in a moment.',
  INTERNAL_ERROR: 'We could not complete your booking right now. Please try again in a moment.',
  INTERNAL_SERVER_ERROR:
    'We could not complete your booking right now. Please try again in a moment.',
  OPERATING_HOURS_CLOSED: 'That time is no longer available for bookings.',
  RESTAURANT_LOOKUP_FAILED: 'We could not load that restaurant right now. Please try again.',
  RESTAURANT_NOT_FOUND: 'We could not find that restaurant. Please go back and try again.',
  RESTAURANT_REQUIRED: 'Please choose a restaurant before trying again.',
  RATE_LIMITED: 'Too many booking attempts right now. Please wait a moment and try again.',
  SERVICE_PERIOD: 'That time is no longer available for bookings.',
  OUTSIDE_WINDOW: 'That time is outside the restaurant operating hours.',
  VALIDATION_FAILED: 'Please check your details and try again.',
  INVALID_RESPONSE: 'We could not confirm your booking right now. Please try again in a moment.',
  MISSING_IDEMPOTENCY_KEY: 'This booking request could not be sent. Please try again.',
  UNSUPPORTED_OPERATION: 'This booking can’t be changed here.',
};

function mappedCodeMessage(record: Record<string, unknown>): string | undefined {
  const codeValue = record.code ?? record.errorCode;
  if (typeof codeValue !== 'string') return undefined;
  return ERROR_CODE_MESSAGES[codeValue.trim().toUpperCase()];
}

function firstMessage(record: Record<string, unknown>): string | undefined {
  for (const value of [record.message, record.error]) {
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return undefined;
}

/**
 * Guest/ops wizard copy for an error. Order: the wizard's own code copy, then
 * `toUserMessage` for HTTP, network and unknown errors (never a 5xx, parser or
 * "Request failed with status N" text), then a 4xx server message, then `fallback`.
 */
export function mapErrorToMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (!error) return fallback;

  if (typeof error === 'string') {
    return error.trim() || fallback;
  }

  if (typeof error !== 'object') return fallback;

  const record = error as Record<string, unknown>;
  const mapped = mappedCodeMessage(record);
  if (mapped) return mapped;

  if (error instanceof Error) {
    // HttpError: 4xx server message or status copy. TypeError from fetch: network
    // copy. Anything else (SyntaxError, programming errors): the fallback.
    return toUserMessage(error, { fallback });
  }

  // A plain ApiError from the reserve client carries its HTTP status.
  if (typeof record.status === 'number' && record.status >= 400) {
    const message = firstMessage(record);
    const httpError = new HttpError({
      message: message ?? '',
      status: record.status,
      code: typeof record.code === 'string' ? record.code : undefined,
      hasServerMessage: message !== undefined,
    });
    return toUserMessage(httpError, { fallback });
  }

  const message = firstMessage(record);
  if (message) return message;

  const issues = record.issues;
  if (Array.isArray(issues)) {
    for (const issue of issues) {
      if (issue && typeof issue === 'object' && 'message' in issue) {
        const issueMessage = (issue as { message?: unknown }).message;
        if (typeof issueMessage === 'string' && issueMessage.trim().length > 0) {
          return issueMessage.trim();
        }
      }
    }
  }

  return fallback;
}
