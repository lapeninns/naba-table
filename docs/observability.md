# Observability contract

Nabatable treats the web application and each Cloudflare Worker as separate services with the same minimum signal contract.

## Signals

| Signal            | Web application                  | Cloudflare Workers                                  |
| ----------------- | -------------------------------- | --------------------------------------------------- |
| Structured logs   | `lib/logger.ts` JSON records     | `cloudflare/shared/observability.ts` JSON records   |
| Trace context     | OpenTelemetry instrumentation    | W3C `traceparent` propagation and response headers  |
| Request identity  | request/correlation IDs          | validated `x-request-id` with generated fallback    |
| Latency profile   | server and route metrics         | `server-timing` plus `durationMs` records           |
| Deployment marker | Vercel commit metadata           | Cloudflare `CF_VERSION_METADATA.id` or `DEPLOY_SHA` |
| Product events    | PostHog schemas                  | `product.*` structured operational events           |
| Error insight     | PostHog server exception capture | optional redacted error-insight webhook             |

Secrets and guest PII must never be placed in fields. The Worker logger also recursively redacts common secret, email, phone, recipient, cookie, and token keys before serialization.

## Error-to-insight integration

Set `ERROR_INSIGHT_WEBHOOK_URL` and the secret `ERROR_INSIGHT_TOKEN` for each Worker to forward unhandled failures to the incident-analysis sink. The payload contains service, event, request ID, trace ID, deploy identifier, route, and scrubbed error context. Failure of this secondary webhook never changes the primary response.

## Alerting and profiling

The reviewed alert contract is `config/observability/alerts.yaml`; service objectives are in `config/observability/service-levels.yaml`. Request duration is emitted on every Worker response and in every completion log. Use Cloudflare Workers Trace Events or Vercel traces for sampled profiles, then correlate by trace ID and deployment ID.

Every alert links to a checked-in runbook. Update thresholds from measured baselines, never by silencing a failing monitor.
