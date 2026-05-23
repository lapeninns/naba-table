export type GoogleBusinessProfileGoogleErrorClassification =
  | 'retryable'
  | 'permission'
  | 'validation'
  | 'unsupported_field'
  | 'quota';

function describeGooglePushError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    if (typeof record.message === 'string' && record.message.trim()) {
      return record.message;
    }
    if (typeof record.details === 'string' && record.details.trim()) {
      return record.details;
    }
  }

  return fallback;
}

export function sanitizeGoogleErrorMessage(message: string): string {
  return message
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [redacted]')
    .replace(/([?&](?:access_token|refresh_token|token|key|secret)=)[^&\s]+/gi, '$1[redacted]')
    .replace(/\b(access_token|refresh_token|token|key|secret)=\S+/gi, '$1=[redacted]')
    .replace(
      /("(?:access_token|refresh_token|token|key|secret)"\s*:\s*")[^"]+"/gi,
      '$1[redacted]"',
    );
}

export function classifyGoogleBusinessProfilePushError(error: unknown): {
  classification: GoogleBusinessProfileGoogleErrorClassification;
  message: string;
} {
  const rawMessage = describeGooglePushError(error, 'Unable to push supported fields to Google.');
  const message = sanitizeGoogleErrorMessage(rawMessage);
  const lower = message.toLowerCase();
  const status =
    error && typeof error === 'object' && 'status' in error
      ? Number((error as { status?: unknown }).status)
      : NaN;
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code).toLowerCase()
      : '';

  if (status === 429 || lower.includes('quota') || lower.includes('rate limit')) {
    return { classification: 'quota', message };
  }
  if (
    status === 401 ||
    status === 403 ||
    lower.includes('permission') ||
    lower.includes('forbidden') ||
    lower.includes('unauthorized') ||
    lower.includes('scope')
  ) {
    return { classification: 'permission', message };
  }
  if (
    lower.includes('unsupported') ||
    lower.includes('update mask') ||
    lower.includes('field mask') ||
    code.includes('unsupported')
  ) {
    return { classification: 'unsupported_field', message };
  }
  if (
    status === 400 ||
    lower.includes('invalid') ||
    lower.includes('validation') ||
    lower.includes('bad request')
  ) {
    return { classification: 'validation', message };
  }

  return { classification: 'retryable', message };
}
