import { trace } from '@opentelemetry/api';
import {
  InMemoryLogRecordExporter,
  LoggerProvider,
  SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { beforeAll, describe, expect, it } from 'vitest';

import { createLogger } from '@/lib/logger';
import {
  getActiveTraceCorrelation,
  resolveRequestCorrelationId,
  sanitizeCorrelationId,
} from '@/lib/observability/request-correlation';

const ZERO_TRACE_ID = '0'.repeat(32);
const ZERO_SPAN_ID = '0'.repeat(16);

describe('request correlation', () => {
  let exporter: InMemoryLogRecordExporter;
  let loggerProvider: LoggerProvider;

  beforeAll(() => {
    // Mirrors src/instrumentation.ts register(): a tracer provider with no span
    // processors, whose register() installs the AsyncLocalStorage context
    // manager that the logs SDK reads span context from.
    const tracerProvider = new NodeTracerProvider();
    tracerProvider.register();

    exporter = new InMemoryLogRecordExporter();
    loggerProvider = new LoggerProvider({
      processors: [new SimpleLogRecordProcessor(exporter)],
    });
  });

  const emitWithinSpan = (spanName: string, message: string) => {
    const tracer = trace.getTracer('correlation-test');
    let correlation: ReturnType<typeof getActiveTraceCorrelation> = null;
    tracer.startActiveSpan(spanName, (span) => {
      const structuredLogger = createLogger(
        { module: 'correlation-test' },
        { otelLogger: loggerProvider.getLogger('correlation-test') },
      );
      structuredLogger.info(message, { spanName });
      correlation = getActiveTraceCorrelation();
      span.end();
    });
    return correlation!;
  };

  it('sanitizes external correlation ids', () => {
    expect(sanitizeCorrelationId('abc123def456')).toBe('abc123def456');
    expect(sanitizeCorrelationId('  <img src=x> lhr1::abcd-12345678 ')).toBe(
      'imgsrcxlhr1::abcd-12345678'.replace('::', '::'),
    );
    expect(sanitizeCorrelationId('short')).toBeNull();
    expect(sanitizeCorrelationId(null)).toBeNull();
    expect(sanitizeCorrelationId('x'.repeat(200))?.length).toBe(64);
  });

  it('returns null outside a span and real ids inside one', () => {
    expect(getActiveTraceCorrelation()).toBeNull();

    const correlation = emitWithinSpan('span-a', 'inside span');
    expect(correlation).not.toBeNull();
    expect(correlation.traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(correlation.traceId).not.toBe(ZERO_TRACE_ID);
    expect(correlation.spanId).toMatch(/^[0-9a-f]{16}$/);
    expect(correlation.spanId).not.toBe(ZERO_SPAN_ID);
  });

  it('stamps log records with the active span context, distinct per request', () => {
    exporter.reset();

    const first = emitWithinSpan('request-1', 'request one log');
    const second = emitWithinSpan('request-2', 'request two log');

    const records = exporter.getFinishedLogRecords();
    expect(records).toHaveLength(2);

    const [firstRecord, secondRecord] = records;
    // Related records share the request's trace id (joinable)…
    expect(firstRecord!.spanContext?.traceId).toBe(first.traceId);
    expect(secondRecord!.spanContext?.traceId).toBe(second.traceId);
    // …and two independent requests never share a trace.
    expect(firstRecord!.spanContext?.traceId).not.toBe(secondRecord!.spanContext?.traceId);
    expect(firstRecord!.spanContext?.traceId).not.toBe(ZERO_TRACE_ID);
    expect(secondRecord!.spanContext?.spanId).not.toBe(ZERO_SPAN_ID);
  });

  it('joins exceptions and events to logs through the same correlation id', () => {
    const correlation = emitWithinSpan('request-3', 'correlated log');
    // resolveRequestCorrelationId inside the same span returns the same trace
    // id that the log record carries — the join key for events/exceptions.
    const tracer = trace.getTracer('correlation-test');
    tracer.startActiveSpan('request-4', (span) => {
      const insideSpan = resolveRequestCorrelationId();
      expect(insideSpan).toBe(getActiveTraceCorrelation()?.traceId);
      span.end();
    });
    expect(correlation.traceId).toMatch(/^[0-9a-f]{32}$/);
  });

  it('falls back to a sanitized request id, then a UUID, when no span exists', () => {
    expect(getActiveTraceCorrelation()).toBeNull();

    const withHeader = resolveRequestCorrelationId({
      get: (name: string) => (name === 'x-request-id' ? 'req <abc> 1234567890' : null),
    });
    expect(withHeader).toBe('reqabc1234567890');

    const generated = resolveRequestCorrelationId({ get: () => null });
    expect(generated).toMatch(/^[0-9a-f-]{36}$/);

    const twice = resolveRequestCorrelationId({ get: () => null });
    expect(twice).not.toBe(generated);
  });
});
