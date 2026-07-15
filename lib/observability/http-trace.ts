const TRACEPARENT_PATTERN = /^00-([0-9a-f]{32})-[0-9a-f]{16}-([0-9a-f]{2})$/u;
const SAFE_REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/u;

function randomHex(length: number): string {
  let value = '';
  while (value.length < length) {
    value += crypto.randomUUID().replaceAll('-', '').toLowerCase();
  }
  return value.slice(0, length);
}

function buildTraceContext(request: Request): {
  requestId: string;
  traceparent: string;
} {
  const suppliedRequestId = request.headers.get('x-request-id');
  const requestId =
    suppliedRequestId && SAFE_REQUEST_ID_PATTERN.test(suppliedRequestId)
      ? suppliedRequestId
      : crypto.randomUUID();
  const incomingTraceparent = request.headers.get('traceparent')?.toLowerCase() ?? '';
  const traceId = incomingTraceparent.match(TRACEPARENT_PATTERN)?.[1] ?? randomHex(32);

  return {
    requestId,
    traceparent: `00-${traceId}-${randomHex(16)}-01`,
  };
}

export async function observeHttpRequest(
  request: Request,
  handler: () => Promise<Response>,
  now: () => number = Date.now,
): Promise<Response> {
  const startedAt = now();
  const context = buildTraceContext(request);
  const response = await handler();
  const headers = new Headers(response.headers);
  headers.set('x-request-id', context.requestId);
  headers.set('traceparent', context.traceparent);
  headers.set('server-timing', `app;dur=${Math.max(0, now() - startedAt)}`);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
