/**
 * Redaction helpers for durable Google audit payloads.
 *
 * Operation rows and operation-group rows are long-lived audit data, so
 * provider summaries must keep masks/status/field context while removing
 * credentials and token-like values before persistence.
 */

import { sanitizeGoogleProviderErrorMessage } from './google-errors';

const SENSITIVE_KEY_PATTERN =
  /(?:^|[_-])(authorization|cookie|set-cookie|access[_-]?token|refresh[_-]?token|id[_-]?token|api[_-]?key|client[_-]?secret|secret|password|credential|session)(?:$|[_-])/i;

const MAX_STRING_LENGTH = 2_000;
const MAX_ARRAY_LENGTH = 100;
const MAX_OBJECT_KEYS = 100;

function truncateString(value: string): string {
  const sanitized = sanitizeGoogleProviderErrorMessage(value);
  if (sanitized.length <= MAX_STRING_LENGTH) return sanitized;
  return `${sanitized.slice(0, MAX_STRING_LENGTH - 3)}...`;
}

function sanitizeValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return truncateString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Error) {
    return {
      name: value.name,
      message: truncateString(value.message),
    };
  }
  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_LENGTH).map((item) => sanitizeValue(item));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value).slice(0, MAX_OBJECT_KEYS)) {
      out[key] = SENSITIVE_KEY_PATTERN.test(key) ? '[redacted]' : sanitizeValue(child);
    }
    return out;
  }
  return String(value);
}

export function sanitizeGoogleAuditPayload<T>(payload: T): unknown {
  return sanitizeValue(payload);
}
