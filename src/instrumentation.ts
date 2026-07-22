import { logs } from '@opentelemetry/api-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs';

const normalizeHost = (host: string): string => host.replace(/\/$/, '');

const resolvePosthogLogsConfig = () => {
  const token = process.env.POSTHOG_PROJECT_API_KEY ?? process.env.NEXT_PUBLIC_POSTHOG_KEY ?? null;
  const host = process.env.POSTHOG_HOST ?? process.env.NEXT_PUBLIC_POSTHOG_HOST ?? null;

  if (!token || !host) return null;

  return {
    token,
    url: `${normalizeHost(host)}/i/v1/logs`,
  };
};

const buildOtelResource = () =>
  resourceFromAttributes({
    'service.name': 'nabatable-web',
    'service.namespace': 'nabatable',
    'deployment.environment': process.env.APP_ENV ?? process.env.NODE_ENV ?? 'unknown',
    'service.version':
      process.env.VERCEL_GIT_COMMIT_SHA ??
      process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
      process.env.NEXT_PUBLIC_APP_VERSION ??
      'unknown',
  });

export const posthogLoggerProvider = (() => {
  const config = resolvePosthogLogsConfig();
  if (!config) return null;

  return new LoggerProvider({
    resource: buildOtelResource(),
    processors: [
      new BatchLogRecordProcessor(
        new OTLPLogExporter({
          url: config.url,
          headers: {
            Authorization: `Bearer ${config.token}`,
            'Content-Type': 'application/json',
          },
        }),
      ),
    ],
  });
})();

let nodeTracingRegistered = false;

/**
 * Registers a Node tracer provider with the default AsyncLocalStorage context
 * manager and W3C propagators. No span processors are attached, so spans are
 * never exported; the provider exists so Next.js records request spans and the
 * OTel Logs SDK stamps real (non-zero) trace/span ids onto every log record
 * emitted inside a request. Exported for tests.
 */
export async function registerNodeTracing(): Promise<boolean> {
  if (nodeTracingRegistered) return true;
  try {
    const { NodeTracerProvider } = await import('@opentelemetry/sdk-trace-node');
    const provider = new NodeTracerProvider({ resource: buildOtelResource() });
    provider.register();
    nodeTracingRegistered = true;
    return true;
  } catch (error) {
    console.warn('[instrumentation] failed to register OpenTelemetry tracing', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    if (posthogLoggerProvider) {
      logs.setGlobalLoggerProvider(posthogLoggerProvider);
    }
    await registerNodeTracing();
  }
}

export async function flushPosthogLogs(): Promise<void> {
  await posthogLoggerProvider?.forceFlush();
}

/**
 * Schedule a PostHog logs flush after the response is sent, for short-lived
 * route handlers (cron/webhooks) that may freeze before the OTLP batch
 * processor's interval fires. Safe to call outside a request scope (e.g. unit
 * tests) — `after()` throws there, so we swallow it and rely on the interval.
 */
export async function flushPosthogLogsAfterResponse(): Promise<void> {
  try {
    const { after } = await import('next/server');
    after(async () => {
      await flushPosthogLogs();
    });
  } catch {
    // Not in a request scope; the BatchLogRecordProcessor flushes on its interval.
  }
}
