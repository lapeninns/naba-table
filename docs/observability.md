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

Each Wrangler configuration points `ERROR_INSIGHT_WEBHOOK_URL` at the authenticated `/api/webhook/error-insight` receiver. Provision the same random value as the Worker `ERROR_INSIGHT_TOKEN` secret and the Vercel `ERROR_INSIGHT_RECEIVER_TOKEN`; configure a fine-grained `ERROR_INSIGHT_GITHUB_TOKEN` limited to this repository with Contents write access. The receiver accepts the three runtime Worker service names and validates a bounded metadata-only payload. The web client-error intake uses the same safe dispatch contract without forwarding exception text. Both paths issue a GitHub `repository_dispatch` event of type `runtime-error`; `.github/workflows/error-to-insight.yml` then creates or updates a deduplicated issue using only service, request, trace, deployment, route, and fingerprint metadata. Failure of this secondary path never changes the primary response.

## Alerting and profiling

The reviewed alert contract is `config/observability/alerts.yaml`; service objectives are in `config/observability/service-levels.yaml`. Request duration is emitted on every Worker response and in every completion log. Worker deployments upload Cloudflare source maps; PostHog exception events include raw stack frames, privacy-safe actor classification, HTTP breadcrumbs, trace context, and deployment identity. Use the per-application profiling commands in `docs/profiling.md`, then correlate profiles by trace ID and deployment ID.

Every alert links to a checked-in runbook. Update thresholds from measured baselines, never by silencing a failing monitor.

## Readiness and monitoring

Every service exposes an authenticated readiness endpoint next to its unauthenticated health check: the web app at `/api/ready` (`src/app/api/ready/route.ts`, helpers in `lib/observability/readiness.ts`) and each Worker at `/ready` (`cloudflare/shared/readiness.ts`). Requests must carry `Authorization: Bearer <MONITORING_TOKEN>`; the comparison is constant-time and a missing or unconfigured token yields a generic `401`. Responses are `cache-control: no-store` and contain `{ service, status, revision, deploymentId, checks[] }`, where `revision` is `NABATABLE_SOURCE_REVISION` (falling back to `VERCEL_GIT_COMMIT_SHA` / `DEPLOY_SHA` / `CF_VERSION_METADATA.id`) and `deploymentId` is `NABATABLE_BUILD_ID` (falling back to `VERCEL_DEPLOYMENT_ID` / `CF_VERSION_METADATA.id`). Checks are read-only and bounded: a probe that exceeds its timeout reports `degraded`, an error reports `down`, and the endpoint answers `503` only when a check is `down`.

The monitoring contract lives in `config/observability/monitoring.yaml` (targets, intervals, heartbeat, evidence thresholds, alert references). `pnpm ops:verify` executes it hourly from the `Monitoring` GitHub environment and `pnpm ops:slo-evidence` computes request-based availability and p95 latency against `service-levels.yaml`, returning `unknown` whenever evidence coverage is below 99 %, the window is shorter than 30 days, or the 14-day warm-up is incomplete. Incident deduplication, bounded updates, acknowledgement, escalation, and auto-resolution are implemented as pure functions in `lib/observability/incidents.ts` and used by the error-insight receiver. Operating procedures are in `docs/runbooks/monitoring.md`.
