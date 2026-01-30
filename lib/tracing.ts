/**
 * Distributed Tracing Utilities
 *
 * Provides request ID generation and propagation for tracing requests
 * across the application. Integrates with Sentry for correlation.
 */

import type { NextRequest } from 'next/server';

export const REQUEST_ID_HEADER = 'x-request-id';
export const TRACE_ID_HEADER = 'x-trace-id';

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  // Edge runtime does not support importing Node.js 'crypto'.
  // Use Web Crypto when available.
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  // Fallback: non-cryptographic unique id.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Extract or generate request ID from incoming request
 */
export function getRequestId(request: NextRequest | Request): string {
  const existing = request.headers.get(REQUEST_ID_HEADER);
  if (existing) {
    return existing;
  }
  return generateRequestId();
}

/**
 * Extract trace context from request headers
 */
export function getTraceContext(request: NextRequest | Request): {
  requestId: string;
  traceId: string | null;
  parentSpanId: string | null;
} {
  return {
    requestId: getRequestId(request),
    traceId:
      request.headers.get(TRACE_ID_HEADER) ||
      request.headers.get('sentry-trace')?.split('-')[0] ||
      null,
    parentSpanId: request.headers.get('sentry-trace')?.split('-')[1] || null,
  };
}

/**
 * Add tracing headers to outgoing response
 */
export function addTracingHeaders(
  headers: Headers,
  requestId: string,
  traceId?: string | null,
): Headers {
  headers.set(REQUEST_ID_HEADER, requestId);
  if (traceId) {
    headers.set(TRACE_ID_HEADER, traceId);
  }
  return headers;
}

/**
 * Create a tracing context for logging
 */
export function createTracingContext(request: NextRequest | Request): Record<string, string> {
  const { requestId, traceId } = getTraceContext(request);
  const context: Record<string, string> = {
    requestId,
    path: new URL(request.url).pathname,
    method: request.method,
  };

  if (traceId) {
    context.traceId = traceId;
  }

  return context;
}

/**
 * Wrap fetch to propagate tracing headers
 */
export function tracedFetch(requestId: string): typeof fetch {
  return (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    headers.set(REQUEST_ID_HEADER, requestId);

    return fetch(input, {
      ...init,
      headers,
    });
  };
}
