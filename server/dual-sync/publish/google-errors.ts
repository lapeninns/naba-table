/**
 * Normalise Google/GBP provider errors into dual-sync publish failures.
 *
 * The operator workflow needs actionable states rather than generic
 * "port failed" messages. This mapper intentionally reads only common
 * Error/object fields so it can classify both `GoogleBusinessProfileError`
 * and plain fetch/client exceptions without importing service internals.
 */

import type { DualSyncOperationFailure } from './types';

function errorField(error: unknown, key: 'code' | 'status' | 'name'): string {
  if (!error || typeof error !== 'object' || !(key in error)) return '';
  const value = (error as Record<string, unknown>)[key];
  return value === null || value === undefined ? '' : String(value);
}

function statusOf(error: unknown): number {
  const status = Number(errorField(error, 'status'));
  return Number.isFinite(status) ? status : NaN;
}

export function sanitizeGoogleProviderErrorMessage(message: string): string {
  return message
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [redacted]')
    .replace(/([?&](?:access_token|refresh_token|token|key|secret)=)[^&\s]+/gi, '$1[redacted]')
    .replace(/\b(access_token|refresh_token|token|key|secret)=\S+/gi, '$1=[redacted]')
    .replace(
      /("(?:access_token|refresh_token|token|key|secret)"\s*:\s*")[^"]+"/gi,
      '$1[redacted]"',
    );
}

function messageOf(error: unknown, fallback: string): string {
  const raw =
    error instanceof Error
      ? error.message
      : error && typeof error === 'object' && 'message' in error
        ? String((error as { message?: unknown }).message ?? fallback)
        : String(error || fallback);
  return sanitizeGoogleProviderErrorMessage(raw || fallback);
}

export function mapGoogleProviderErrorToPublishFailure(
  error: unknown,
  fallbackMessage = 'Google Business Profile publish failed.',
): DualSyncOperationFailure {
  const message = messageOf(error, fallbackMessage);
  const lowerMessage = message.toLowerCase();
  const code = errorField(error, 'code').toLowerCase();
  const name = errorField(error, 'name').toLowerCase();
  const status = statusOf(error);

  if (code === 'gbp_reauth_required' || lowerMessage.includes('invalid_grant')) {
    return {
      code: 'REAUTH_REQUIRED',
      message,
      retryable: false,
    };
  }

  if (
    status === 429 ||
    code.includes('quota') ||
    lowerMessage.includes('quota') ||
    lowerMessage.includes('rate limit')
  ) {
    return {
      code: 'QUOTA_LIMITED',
      message,
      retryable: true,
    };
  }

  if (
    status === 401 ||
    status === 403 ||
    code === 'gbp_forbidden' ||
    lowerMessage.includes('permission') ||
    lowerMessage.includes('forbidden') ||
    lowerMessage.includes('unauthorized') ||
    lowerMessage.includes('insufficient scope') ||
    lowerMessage.includes('location access')
  ) {
    return {
      code: 'LOCATION_ACCESS_LOST',
      message,
      retryable: false,
    };
  }

  if (
    code.includes('unsupported') ||
    lowerMessage.includes('unsupported') ||
    lowerMessage.includes('update mask') ||
    lowerMessage.includes('field mask')
  ) {
    return {
      code: 'UNSUPPORTED_FIELD',
      message,
      retryable: false,
    };
  }

  if (
    status === 400 ||
    lowerMessage.includes('invalid') ||
    lowerMessage.includes('validation') ||
    lowerMessage.includes('bad request')
  ) {
    return {
      code: 'GOOGLE_VALIDATION_FAILED',
      message,
      retryable: false,
    };
  }

  if (
    name.includes('timeout') ||
    code.includes('timeout') ||
    lowerMessage.includes('timeout') ||
    lowerMessage.includes('timed out')
  ) {
    return {
      code: 'EXTERNAL_API_TIMEOUT',
      message,
      retryable: true,
    };
  }

  return {
    code: 'EXTERNAL_API_ERROR',
    message,
    retryable: true,
  };
}
