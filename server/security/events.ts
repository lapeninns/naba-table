import { recordObservabilityEvent } from '@/server/observability';

import type { Json } from '@/types/supabase';

export type SecurityEventType =
  | 'cross_tenant_access_denied'
  | 'csrf_failure'
  | 'cron_auth_failure'
  | 'unsafe_url_rejected'
  | 'invite_acceptance_rejected'
  | 'rate_limit_exceeded'
  | 'token_redaction_detected';

type SecurityEventSeverity = 'notice' | 'warning' | 'error' | 'critical';

type SecurityEventParams = {
  eventType: SecurityEventType;
  source: string;
  severity?: SecurityEventSeverity;
  restaurantId?: string | null;
  bookingId?: string | null;
  context?: Record<string, unknown> | null;
};

const SENSITIVE_KEY_PATTERN =
  /(?:authorization|cookie|jwt|key|otp|password|refresh|secret|session|token|token_hash)/i;

function redactSecurityContext(value: unknown): Json {
  if (value === null || value === undefined) {
    return null;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSecurityContext(item)) as Json;
  }

  if (typeof value === 'object') {
    const redacted: Record<string, Json> = {};
    for (const [key, child] of Object.entries(value)) {
      redacted[key] = SENSITIVE_KEY_PATTERN.test(key) ? '[redacted]' : redactSecurityContext(child);
    }
    return redacted as Json;
  }

  if (typeof value === 'string') {
    return value.length > 256 ? `${value.slice(0, 253)}...` : value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  return String(value);
}

export async function recordSecurityEvent({
  eventType,
  source,
  severity = 'warning',
  restaurantId = null,
  bookingId = null,
  context = null,
}: SecurityEventParams): Promise<void> {
  await recordObservabilityEvent({
    source,
    eventType: `security.${eventType}`,
    severity,
    restaurantId,
    bookingId,
    context: redactSecurityContext(context),
  });
}
