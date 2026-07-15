export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogFields = Readonly<Record<string, unknown>>;
export type LogSink = (serializedRecord: string) => void;

type RequestObservationInput = {
  readonly request: Request;
  readonly service: string;
  readonly deploySha?: string;
  readonly handler: () => Promise<Response>;
  readonly sink?: LogSink;
  readonly now?: () => number;
  readonly errorInsight?: {
    readonly url?: string;
    readonly token?: string;
    readonly waitUntil?: (promise: Promise<unknown>) => void;
  };
};

const TRACEPARENT_PATTERN = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/u;
const SAFE_REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/u;
const SENSITIVE_KEY_PATTERN =
  /authorization|cookie|email|phone|recipient|password|secret|token|api[-_]?key/iu;

function scrubString(value: string): string {
  return value
    .replace(/Bearer\s+[^\s]+/giu, 'Bearer [REDACTED]')
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/gu, '[REDACTED]')
    .replace(/\+?\d[\d\s().-]{8,}\d/gu, '[REDACTED]');
}

function redactValue(value: unknown, key = ''): unknown {
  if (SENSITIVE_KEY_PATTERN.test(key)) {
    return '[REDACTED]';
  }
  if (typeof value === 'string') {
    return scrubString(value);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => redactValue(entry));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        redactValue(entryValue, entryKey),
      ]),
    );
  }
  return value;
}

export function redactLogFields(fields: LogFields): Record<string, unknown> {
  return redactValue(fields) as Record<string, unknown>;
}

export function buildErrorInsightRequest(input: {
  readonly url: string;
  readonly token: string;
  readonly service: string;
  readonly event: string;
  readonly fields: LogFields;
}): { url: string; init: RequestInit } {
  return {
    url: new URL(input.url).toString(),
    init: {
      method: 'POST',
      headers: {
        authorization: `Bearer ${input.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        service: input.service,
        event: input.event,
        fields: redactLogFields(input.fields),
      }),
    },
  };
}

export async function reportErrorInsight(input: {
  readonly url?: string;
  readonly token?: string;
  readonly service: string;
  readonly event: string;
  readonly fields: LogFields;
  readonly fetcher?: typeof fetch;
}): Promise<void> {
  if (!input.url || !input.token) return;
  const request = buildErrorInsightRequest({
    url: input.url,
    token: input.token,
    service: input.service,
    event: input.event,
    fields: input.fields,
  });
  const response = await (input.fetcher ?? fetch)(request.url, request.init);
  if (!response.ok) throw new Error(`Error insight webhook returned ${response.status}.`);
}

function randomHex(length: number): string {
  let value = '';
  while (value.length < length) {
    value += crypto.randomUUID().replaceAll('-', '').toLowerCase();
  }
  return value.slice(0, length);
}

function requestContext(request: Request): {
  requestId: string;
  traceId: string;
  traceparent: string;
} {
  const suppliedRequestId = request.headers.get('x-request-id');
  const requestId =
    suppliedRequestId && SAFE_REQUEST_ID_PATTERN.test(suppliedRequestId)
      ? suppliedRequestId
      : crypto.randomUUID();
  const incomingTrace = request.headers.get('traceparent')?.toLowerCase() ?? '';
  const traceId = incomingTrace.match(TRACEPARENT_PATTERN)?.[1] ?? randomHex(32);
  const traceparent = `00-${traceId}-${randomHex(16)}-01`;
  return { requestId, traceId, traceparent };
}

export function writeStructuredLog(input: {
  readonly level: LogLevel;
  readonly event: string;
  readonly service: string;
  readonly fields?: LogFields;
  readonly sink?: LogSink;
  readonly timestamp?: string;
}): void {
  const record = {
    timestamp: input.timestamp ?? new Date().toISOString(),
    level: input.level,
    event: input.event,
    service: input.service,
    ...redactLogFields(input.fields ?? {}),
  };
  (input.sink ?? console.log)(JSON.stringify(record));
}

export async function observeWorkerRequest(input: RequestObservationInput): Promise<Response> {
  const now = input.now ?? Date.now;
  const startedAt = now();
  const context = requestContext(input.request);

  try {
    const response = await input.handler();
    const completedAt = now();
    const durationMs = Math.max(0, completedAt - startedAt);
    const headers = new Headers(response.headers);
    headers.set('x-request-id', context.requestId);
    headers.set('traceparent', context.traceparent);
    headers.set('server-timing', `app;dur=${durationMs}`);
    writeStructuredLog({
      level: response.status >= 500 ? 'error' : response.status >= 400 ? 'warn' : 'info',
      event: 'http.request.completed',
      service: input.service,
      sink: input.sink,
      timestamp: new Date(completedAt).toISOString(),
      fields: {
        requestId: context.requestId,
        traceId: context.traceId,
        deploySha: input.deploySha ?? 'unknown',
        method: input.request.method,
        path: new URL(input.request.url).pathname,
        status: response.status,
        durationMs,
      },
    });
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (error) {
    const errorFields = {
      requestId: context.requestId,
      traceId: context.traceId,
      deploySha: input.deploySha ?? 'unknown',
      method: input.request.method,
      path: new URL(input.request.url).pathname,
      error: error instanceof Error ? error.message : String(error),
    };
    writeStructuredLog({
      level: 'error',
      event: 'http.request.failed',
      service: input.service,
      sink: input.sink,
      fields: errorFields,
    });
    const insight = reportErrorInsight({
      url: input.errorInsight?.url,
      token: input.errorInsight?.token,
      service: input.service,
      event: 'http.request.failed',
      fields: errorFields,
    }).catch(() => undefined);
    input.errorInsight?.waitUntil?.(insight);
    throw error;
  }
}
