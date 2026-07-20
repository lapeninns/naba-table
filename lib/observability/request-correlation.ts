import { isSpanContextValid, trace } from '@opentelemetry/api';

export type ActiveTraceCorrelation = {
  traceId: string;
  spanId: string;
};

const CORRELATION_ID_SAFE_PATTERN = /[^A-Za-z0-9._:-]/g;
const CORRELATION_ID_MIN_LENGTH = 8;
const CORRELATION_ID_MAX_LENGTH = 64;

/**
 * Returns the trace/span ids of the active OpenTelemetry span, or null when no
 * valid span context exists (e.g. tracing not registered, background job).
 */
export function getActiveTraceCorrelation(): ActiveTraceCorrelation | null {
  const spanContext = trace.getActiveSpan()?.spanContext();
  if (!spanContext || !isSpanContextValid(spanContext)) {
    return null;
  }
  return { traceId: spanContext.traceId, spanId: spanContext.spanId };
}

/**
 * Sanitizes an externally supplied correlation/request id (headers, client
 * payloads) down to a bounded safe charset so it can be logged and attached to
 * analytics without log-injection or PII risk. Returns null when the input is
 * too short to be a useful id after cleaning.
 */
export function sanitizeCorrelationId(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(CORRELATION_ID_SAFE_PATTERN, '').slice(0, CORRELATION_ID_MAX_LENGTH);
  return cleaned.length >= CORRELATION_ID_MIN_LENGTH ? cleaned : null;
}

/**
 * Resolves the correlation id for the current request: the active trace id
 * when a span exists (so logs, events, and exceptions all join on the same
 * value), otherwise a sanitized inbound request id, otherwise a fresh UUID.
 */
export function resolveRequestCorrelationId(
  headers?: Pick<Headers, 'get'> | null,
): string {
  const active = getActiveTraceCorrelation();
  if (active) return active.traceId;

  const inbound =
    sanitizeCorrelationId(headers?.get('x-request-id')) ??
    sanitizeCorrelationId(headers?.get('x-vercel-id'));
  if (inbound) return inbound;

  return crypto.randomUUID();
}
