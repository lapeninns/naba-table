# Observability contract

Nabatable treats the web application and each Cloudflare Worker as separate services with the same minimum signal contract.

## Signals

| Signal            | Web application                   | Cloudflare Workers                                  |
| ----------------- | --------------------------------- | --------------------------------------------------- |
| Structured logs   | `lib/logger.ts` JSON records      | `cloudflare/shared/observability.ts` JSON records   |
| Trace context     | W3C propagation and OpenTelemetry | W3C `traceparent` propagation and response headers  |
| Request identity  | request/correlation IDs           | validated `x-request-id` with generated fallback    |
| Latency profile   | server and route metrics          | `server-timing` plus `durationMs` records           |
| Deployment marker | Vercel commit metadata            | Cloudflare `CF_VERSION_METADATA.id` or `DEPLOY_SHA` |
| Product events    | PostHog schemas                   | PII-safe PostHog Worker usage events                |
| Error insight     | PostHog server exception capture  | PostHog `$exception` plus redacted incident webhook |

Secrets and guest PII must never be placed in fields. The Worker logger also recursively redacts common secret, email, phone, recipient, cookie, and token keys before serialization.

## Error-to-insight integration

Set the `POSTHOG_PROJECT_API_KEY` secret for each Worker; `POSTHOG_HOST` is declared in each Wrangler configuration. Workers capture request usage and contextual `$exception` events with service, request, trace, and deployment identifiers. Payloads pass through the shared redactor before delivery.

Set `ERROR_INSIGHT_WEBHOOK_URL` and the secret `ERROR_INSIGHT_TOKEN` to forward unhandled failures to an incident-analysis webhook. That sink can issue a GitHub `repository_dispatch` event of type `posthog-error` or `worker-error`; `.github/workflows/error-to-insight.yml` creates or updates a deduplicated issue using only scrubbed service, trace, deployment, and fingerprint metadata. Failure of either secondary path never changes the primary response.

## Alerting and profiling

The reviewed alert contract is `config/observability/alerts.yaml`; service objectives are in `config/observability/service-levels.yaml`. Request duration is emitted on every Worker response and in every completion log. Use the per-application profiling commands in `docs/profiling.md`, then correlate profiles by trace ID and deployment ID.

Every alert links to a checked-in runbook. Update thresholds from measured baselines, never by silencing a failing monitor.
