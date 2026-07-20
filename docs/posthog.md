# PostHog Operations

## Runtime

- Set `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` for browser analytics.
- Server-side analytics, error capture, and logs reuse the public project token by default. Set `POSTHOG_PROJECT_API_KEY` and `POSTHOG_HOST` only when the server should use different values from the browser SDK.
- Production env validation requires both values.
- Public/root-host and app-host ops routes initialize PostHog when configured.
- Root-host `/app` transport paths and app-host ops routes emit pageviews through the shared client instrumentation.
- Authenticated users are identified by stable Supabase user id only. Do not add email, phone, restaurant names, or other custom sensitive identity properties.

## Client analytics and replay

- `lib/posthog/provider.tsx` initializes `posthog-js` on the client with:
  - manual `$pageview` capture via `src/instrumentation-client.ts`
  - `autocapture: true` for click, rage-click, and heatmap use cases
  - `capture_pageleave: true`
  - `capture_exceptions: true` — explicit client-side exception autocapture.
    The explicit boolean overrides the remote
    `$exception_capture_enabled_server_side` flag, so unhandled errors and
    rejections produce native `$exception` events even while the PostHog
    project setting is off (console errors stay off). The noisy IndexedDB
    suppression in `lib/posthog/error-filter.ts` still filters them via
    `before_send`.
  - `person_profiles: 'identified_only'`
  - URL and noisy-exception filtering through `lib/posthog/error-filter.ts`
- Session replay, heatmaps, and web vitals still require the matching PostHog project settings to be enabled in the PostHog UI. Enabling the project-level "Exception autocapture" setting is still recommended for consistency, but the client no longer depends on it.
- Custom browser events must go through `track()` in `lib/analytics.ts` so event names and properties stay allowlisted and privacy-safe.

## Server analytics and error capture

Use `lib/posthog/server.ts` for server-side PostHog calls:

```ts
import {
  captureServerEvent,
  captureServerException,
  flushPosthogServerClient,
} from '@/lib/posthog/server';

captureServerEvent('booking_created', {
  bookingId: booking.id,
  restaurantId: booking.restaurant_id,
  source: 'api',
});

try {
  // risky server work
} catch (error) {
  captureServerException(error, {
    distinctId: user.id,
    properties: { path: '/api/bookings', source: 'api' },
  });
  throw error;
}

await flushPosthogServerClient();
```

Delivery guarantees (serverless-safe):

- The server client is constructed with the posthog-node `waitUntil` option
  wired to Next.js `after()`: every enqueue schedules a debounced background
  flush whose completion keeps the invocation alive, so events are delivered
  without blocking responses and without being lost to a serverless freeze.
- `captureServerException` uses `captureExceptionImmediate` on a background
  promise handed to `after()` — the `$exception` event (message, error type,
  sanitized stack) is sent before the function freezes, never on the response
  path. Exception text is sanitized through the logger redactions
  (emails/phones/tokens/query strings) and enriched with `release:
'nabatable-web'`, `deploySha`, and a `correlationId`/`traceId` that joins the
  exception to the matching structured logs and analytics events.
- `flushPosthogServerAfterResponse()` remains available for cron/webhook
  handlers that emit critical events late in the request.

Guidelines:

- Prefer a stable Supabase user id as `distinctId` when one is available.
- Use the privacy-safe server default only for system/background events where no user exists.
- Pass only allowlisted analytics properties; emails, phone numbers, tokens, raw URLs with query strings, restaurant names, and provider secrets are intentionally dropped or stripped.
- For events tied to a restaurant, prefer the `captureRestaurantServerEvent` helper, which sets the PostHog `restaurant` group and includes `restaurantId` automatically.

```ts
import { captureRestaurantServerEvent } from '@/lib/posthog/server';

captureRestaurantServerEvent('booking_created', {
  restaurantId,
  distinctId: user?.id, // omit for anonymous/public flows → server:<env> fallback
  props: { bookingId, source: 'api' },
});
```

## Server event instrumentation map

The table below documents the privacy-safe events emitted across Nabatable flows. Server
events are emitted via `captureServerEvent` / `captureRestaurantServerEvent`; exceptions
via `captureServerException`. All properties pass through `sanitizeAnalyticsProps`, so any
non-allowlisted key (email, phone, raw token, delivery-log id, full URL) is dropped.

| Event                                                 | Where emitted                                                                  | Client/Server               | distinctId                              | Allowed properties                                                    | Privacy notes                                                   | QA command                                      |
| ----------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------- | --------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------- |
| `booking_create_started`                              | `server/bookings/bookings-post-response.ts`                                    | server                      | server:&lt;env&gt; (public)             | restaurantId, source, attemptId, attempt, correlationId               | restaurant group                                                | `qa:public-booking:api`                         |
| `booking_created`                                     | `server/bookings/create-completion.ts`                                         | server (also client wizard) | server:&lt;env&gt;                      | bookingId, restaurantId, source, idempotent                           | restaurant group                                                | `qa:public-booking:api`                         |
| `booking_duplicate_prevented`                         | `server/bookings/create-completion.ts`                                         | server                      | server:&lt;env&gt;                      | bookingId, restaurantId, source                                       | emitted when idempotent reuse                                   | `qa:public-booking:api`                         |
| `booking_capacity_rejected`                           | `server/bookings/capacity-failure-response.ts`                                 | server                      | server:&lt;env&gt;                      | restaurantId, code, source, reason                                    | reason ∈ {capacity_full, conflict}                              | `qa:public-booking:api`                         |
| `booking_create_failed`                               | `server/bookings/create-failure-response.ts`                                   | server                      | server:&lt;env&gt;                      | restaurantId, code, status, source, attemptId, attempt, correlationId | + captureServerException + structured log (same correlationId)  | `qa:public-booking:api`                         |
| `client_error_reported`                               | `src/app/api/client-error/route.ts` (server-side after acceptance)             | server                      | userId (if valid) or server:&lt;env&gt; | type, path, fingerprint, correlationId                                | production deployments + non-localhost origins only, deduped    | —                                               |
| `availability_slots_loaded`                           | `src/app/api/availability/route.ts`                                            | server                      | server:&lt;env&gt;                      | restaurantId, available, slotCount, source                            | counts only, no times                                           | `qa:public-booking:api`                         |
| `availability_no_slots_shown`                         | `src/app/api/availability/route.ts`                                            | server                      | server:&lt;env&gt;                      | restaurantId, source                                                  | restaurant group                                                | `qa:public-booking:api`                         |
| `availability_request_failed`                         | `src/app/api/availability/route.ts`                                            | server                      | server:&lt;env&gt;                      | source, path                                                          | + captureServerException                                        | `qa:public-booking:api`                         |
| `booking_modify_started` / `_failed`                  | `src/app/api/bookings/[id]/route.ts`, `src/app/api/ops/bookings/[id]/route.ts` | server                      | user.id (auth) or server:&lt;env&gt;    | bookingId, restaurantId, source, method, code/status/reason           | reason is an enum; `_failed` adds captureServerException on 5xx | `qa:public-booking:api`, `qa:ops-lifecycle:api` |
| `booking_cancel_started` / `_failed`                  | `src/app/api/bookings/[id]/route.ts`, `src/app/api/ops/bookings/[id]/route.ts` | server                      | user.id (auth) or server:&lt;env&gt;    | bookingId, restaurantId, source, method, reason                       | reason ∈ {cutoff_passed, unexpected}                            | `qa:public-booking:api`, `qa:ops-lifecycle:api` |
| `table_assignment_started` / `_completed` / `_failed` | `src/app/api/ops/bookings/[id]/assign-tables/route.ts`                         | server                      | user.id                                 | bookingId, restaurant_id, source, assignedCount, kind, code, reason   | `kind` records the assignment path label                        | `qa:capacity-tables:api`                        |
| `email_delivery_retry_clicked`                        | `src/components/features/email-delivery/useOpsEmailDeliveryRetryState.ts`      | client                      | identified user                         | provider, source                                                      | no recipient, no log id                                         | `qa:customers-delivery:api`                     |
| `email_delivery_retry_failed`                         | retry route + client hook                                                      | both                        | user.id (server)                        | provider, source, reason                                              | no recipient, no log id                                         | `qa:customers-delivery:api`                     |
| `gbp_authorization_started` / `_failed`               | `src/app/api/ops/restaurants/[id]/google-business-profile/connect/route.ts`    | server                      | access.userId                           | restaurantId, source                                                  | + captureServerException                                        | `qa:gbp-dual-sync:api`                          |
| `gbp_publish_started` / `_completed` / `_failed`      | `.../google-business-profile/drafts/[draftId]/publish/route.ts`                | server                      | access.userId                           | restaurantId, draftId, source, status                                 | + captureServerException                                        | `qa:gbp-dual-sync:api`                          |
| `restaurant_profile_section_save_failed`              | `src/app/api/ops/restaurants/[id]/route.ts`                                    | server (also client editor) | user.id                                 | restaurantId, section, source                                         | + captureServerException                                        | —                                               |
| `reserve_step_viewed`                                 | `reserve/.../hooks/useReservationWizard.ts`                                    | client (Plausible-only)     | —                                       | step                                                                  | see reserve note below                                          | `qa:reserve-app:api`                            |
| `wizard_submit_failed`                                | `reserve/.../api/useCreateReservation.ts`, `useCreateOpsReservation.ts`        | client                      | device/identified                       | code, status, bookingId, context, attemptId, attempt                  | canonical client failure event (see note below)                 | `qa:reserve-app:api`                            |

Exception-only coverage (no named event, `captureServerException` in existing catch blocks):
ops lifecycle (`_shared/lifecycleRoute.ts`), cron jobs (`process-emails`, `auto-complete-bookings`,
`dual-sync/auto-export`) with `{ jobName, runId, source: 'cron' }`, and webhooks
(`webhook/resend`, `webhook/twilio/sms-status`) with `{ provider, source: 'webhook' }`.

**Reserve app note:** `reserve/shared/lib/analytics.ts` `track()` forwards to both Plausible
and PostHog. When the wizard renders inside the main Next.js app (the
`/restaurants/[slug]/book` page, which is wrapped by `PostHogProvider`), it reaches
`window.posthog` (or queues to `window.__posthogQueue`, drained by the provider) and the
events flow to PostHog with the same `before_send` URL sanitisation as the main app. In the
standalone Vite build (no provider) the PostHog call is a silent no-op and only Plausible
receives events.

**Canonical failure events (2026-07-20):** one customer submission failure emits exactly one
client event — `wizard_submit_failed` — and one server outcome event —
`booking_create_failed`. The former duplicate `reserve_submit_failed` is retired (removed
from both allowlists; do not re-add). The two records join on `attemptId`, a client-generated
random UUID sent via the `X-Booking-Attempt-Id` header that stays stable across retries of
one logical submission; `attempt` (from `X-Booking-Attempt`) increments per retry so retries
can be distinguished from independent failures. The server additionally stamps
`booking_create_started` / `booking_create_failed`, the structured failure log, and the
captured `$exception` with the same `correlationId` (the active OTel trace id, or a
sanitized request id when no span exists). Any dashboard still reading
`reserve_submit_failed` must be repointed at `wizard_submit_failed` (its historical events
remain queryable).

**Client error reports:** `client_error_reported` is now captured **server-side** by
`/api/client-error` only after a report is accepted and validated (props: `type`, `path`,
`fingerprint`), so analytics can never disagree with the Logs record. The browser reporter
(`lib/monitoring/clientReporter.ts`) throttles per session (max 20 reports, 3 per
fingerprint, 1 generic cross-origin "Script error."), and never reports from
non-production builds, previews, or localhost. The route skips analytics for
non-production deployments and localhost origins, deduplicates by fingerprint per
instance, and logs stackless generic script errors at warn level without analytics.

**SMS retry:** `sms_delivery_retry_clicked` / `sms_delivery_retry_failed` are reserved in
the allowlist but not yet wired — there is currently no dedicated SMS retry route or UI
(the SMS delivery surface is read-only). Wire them when an SMS retry action ships.

### Controlled-vocabulary props

Some props are privacy-safe only because emit sites pass a controlled enum (the sanitizer
validates keys, not string contents). Keep these to the documented values:

- `reason`: `capacity_full`, `conflict`, `cutoff_passed`, `validation`, `unexpected`
- `step`: `plan`, `details`, `review`, `confirmation`
- `jobName`: `process-emails`, `auto-complete-bookings`, `dual-sync.auto-export`
- `provider`: `resend`, `twilio`
- `source`: `api`, `ops`, `cron`, `webhook`, `auth`
- `method`: `guest`, `ops`
- `kind`: lifecycle label (`check-in`/`check-out`/...) or table-assignment path label (`v1`)
- `context`: `customer`, `ops` (wizard failure surface)
- `attemptId` / `correlationId`: sanitized ids (safe charset, 8–64 chars) — random UUIDs
  or trace ids only, never user data
- `attempt`: integer 1–100
- `fingerprint`: short hash (`f` + hex) of a client error's type/message/stack head/path

## Live project state (updated 2026-07-20, project 120939)

Confirmed flowing in production:

- **Client ingestion is live** — custom events (`auth_*`, `booking_*`, `restaurant_profile_*`,
  `user_signed_up`, `client_error_reported`) and autocapture are arriving.
- **Session replay is active** on the public booking page and the ops app.
- **Server events** (`booking_create_*`, `availability_*`, `table_assignment_*`) are live.
- **Logs export is live** (5.5k records retained as of 2026-07-20).

Known-broken before the 2026-07-20 fixes (this change addresses them; verify after deploy):

- **`$exception` count was zero** across the entire project despite widespread
  `captureServerException` calls: server events were buffered but never flushed before the
  serverless freeze, and client exception autocapture was disabled remotely
  (`$exception_capture_enabled_server_side: false`). Fixed by immediate `after()`-backed
  exception delivery on the server and explicit `capture_exceptions: true` on the client.
- **All log `trace_id`/`span_id` values were zero** — no tracer provider was registered.
  `src/instrumentation.ts` now registers a no-export `NodeTracerProvider` (AsyncLocalStorage
  context manager) so Next.js request spans stamp real ids onto every log record.

External PostHog settings (cannot be changed from this repo — do NOT assume done):

- Project setting **Error tracking → Exception autocapture** is off
  (`$exception_capture_enabled_server_side: false`). The client now overrides it explicitly,
  but turn the setting on for consistency and to cover surfaces without our init config.
- Source maps only symbolicate once a deploy runs with `POSTHOG_SOURCEMAP_UPLOAD=true`,
  `POSTHOG_CLI_API_KEY`, and `POSTHOG_CLI_PROJECT_ID` configured on Vercel; the build script
  now chains `posthog:sourcemaps` (no-op without the flag) using release `nabatable-web`
  and the deploy SHA.

## Logs

- `src/instrumentation.ts` registers an OpenTelemetry log exporter for the Node runtime when PostHog env vars are present, plus a no-export `NodeTracerProvider` so log records carry real per-request `trace_id`/`span_id` values (they were previously all zeros). Related records (logs, `booking_create_*` events, `$exception`) share the trace id as `correlationId`; when no span exists a sanitized request id is used instead (`lib/observability/request-correlation.ts`).
- `lib/logger.ts` keeps writing sanitized JSON to the console and also emits sanitized structured records to OpenTelemetry/PostHog Logs.
- Log export is disabled automatically when no PostHog project token/host is configured.
- For short-lived route handlers, call `flushPosthogLogs()` from `src/instrumentation.ts` via `after()` when a log must be delivered before the serverless function freezes.
- Noise controls (2026-07-20): healthy `ops.summary.fetch` and `ops.booking_api.timing`
  records are sampled 1-in-10 (`lib/observability/log-sampling.ts`); slow requests
  (≥1s summary / ≥1.2s ops API) and non-2xx always log, failures at warn. The healthy
  "strict hold enforcement active" record is debug-level (failures remain error/warn).
  Capacity fallback warnings dedupe per restaurant/service/slot per process
  (6h TTL) — see `docs/capacity-service-fallback.md`.

Example:

```ts
import { after } from 'next/server';
import { flushPosthogLogs } from '@/src/instrumentation';
import { logger } from '@/lib/logger';

logger.error('booking creation failed', { path: '/api/bookings', status: 500 });
after(async () => {
  await flushPosthogLogs();
});
```

Never log raw customer emails, phone numbers, tokens, provider payloads, or unredacted request headers. The shared logger redacts common cases, but callers are still responsible for keeping metadata minimal.

## CLI

The repo pins `@posthog/cli` and exposes:

- `pnpm run posthog:schema:status`
- `pnpm run posthog:schema:pull`
- `pnpm run posthog:sourcemaps`

CLI authentication requires `POSTHOG_CLI_API_KEY` and `POSTHOG_CLI_PROJECT_ID`, or an existing local `posthog-cli login` credential file.
`posthog:schema:pull` wraps the CLI prompt with `expect` because PostHog CLI `0.7.11` still asks for the target language even when `--output` and `posthog.json` are present.

Required token scopes:

- `error_tracking:read` for error tracking inspection.
- `error_tracking:write` for `posthog:sourcemaps`.
- Schema scope for `posthog:schema:status` and `posthog:schema:pull`.
- `query:read` only when running optional SQL or HogQL CLI queries such as `posthog-cli exp query run`.

## Source Maps

Source-map upload is opt-in:

1. Set `POSTHOG_SOURCEMAP_UPLOAD=true`.
2. Set `POSTHOG_CLI_API_KEY`, `POSTHOG_CLI_PROJECT_ID`, and `NEXT_PUBLIC_POSTHOG_HOST`.
3. Ensure `VERCEL_GIT_COMMIT_SHA` or `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` is present.
4. Run `pnpm run build`.
5. Run `pnpm run posthog:sourcemaps`.

The upload script uses `.next/static/chunks`, release name `nabatable-web`, and the Vercel commit SHA as the release version. Ordinary local builds do not upload source maps unless the upload flag and credentials are present.
