import { type NextRequest, NextResponse } from 'next/server';

import { generateRequestId, REQUEST_ID_HEADER, TRACE_ID_HEADER } from '@/lib/tracing';

/**
 * Next.js Middleware
 *
 * Adds distributed tracing headers to all requests for observability.
 * Request IDs are propagated through the application and logged.
 */
export function middleware(request: NextRequest) {
  // Get or generate request ID
  const requestId = request.headers.get(REQUEST_ID_HEADER) || generateRequestId();

  // Get trace ID from Sentry or generate one
  const sentryTrace = request.headers.get('sentry-trace');
  const traceId = sentryTrace?.split('-')[0] || request.headers.get(TRACE_ID_HEADER) || requestId;

  // Clone the request headers and add tracing
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);
  requestHeaders.set(TRACE_ID_HEADER, traceId);

  // Create response with tracing headers
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Add tracing headers to response for client visibility
  response.headers.set(REQUEST_ID_HEADER, requestId);
  response.headers.set(TRACE_ID_HEADER, traceId);

  return response;
}

/**
 * Configure which paths the middleware runs on
 * Excludes static files and Next.js internals
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
