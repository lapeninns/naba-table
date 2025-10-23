const ERROR_CODE_MESSAGES: Record<string, string> = {
  CAPACITY_EXCEEDED: 'No tables are available at that time. Please choose another slot.',
  RATE_LIMITED: 'Too many booking attempts right now. Please wait a moment and try again.',
  SERVICE_PERIOD: 'That time is no longer available for bookings.',
  OUTSIDE_WINDOW: 'That time is outside the restaurant operating hours.',
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

    const codeValue = record.code ?? record.errorCode;
    if (typeof codeValue === 'string') {
      const normalizedCode = codeValue.trim().toUpperCase();
      const mapped = ERROR_CODE_MESSAGES[normalizedCode];
      if (mapped) {
        return mapped;
      }
    }
  }

  return fallback;
}
