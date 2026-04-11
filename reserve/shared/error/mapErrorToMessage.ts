const ERROR_CODE_MESSAGES: Record<string, string> = {
  CAPACITY_EXCEEDED: 'No tables are available at that time. Please choose another slot.',
  CAPACITY_UNAVAILABLE: 'We cannot confirm availability right now. Please try again in a moment.',
  DUPLICATE_RESOURCE:
    'We already have a booking with those details. Please check your confirmation email or call the restaurant if you need help.',
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
};

export function mapErrorToMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (!error) return fallback;

  if (typeof error === 'string') {
    return error.trim() || fallback;
  }

  if (error instanceof Error) {
    return error.message?.trim() || fallback;
  }

  if (typeof error === 'object' && error !== null) {
    const record = error as Record<string, unknown>;
    const codeValue = record.code ?? record.errorCode;
    if (typeof codeValue === 'string') {
      const normalizedCode = codeValue.trim().toUpperCase();
      const mapped = ERROR_CODE_MESSAGES[normalizedCode];
      if (mapped) {
        return mapped;
      }
    }

    const maybeMessage = record.message;
    if (typeof maybeMessage === 'string' && maybeMessage.trim().length > 0) {
      return maybeMessage.trim();
    }

    const maybeErrorMessage = record.error;
    if (typeof maybeErrorMessage === 'string' && maybeErrorMessage.trim().length > 0) {
      return maybeErrorMessage.trim();
    }

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
  }

  return fallback;
}
