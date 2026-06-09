# PostHog Operations

## Runtime

- Set `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` for browser analytics.
- Server-side analytics, error capture, feature flag evaluation, and logs reuse the public project token by default. Set `POSTHOG_PROJECT_API_KEY` and `POSTHOG_HOST` only when the server should use different values from the browser SDK.
- Set `POSTHOG_PERSONAL_API_KEY` only when server-side feature flag local evaluation needs a personal key. Do not expose this value to the browser.
- Production env validation requires both values.
- Public/root-host and app-host ops routes initialize PostHog when configured.
- Root-host `/app` transport paths and app-host ops routes emit pageviews through the shared client instrumentation.
- Authenticated users are identified by stable Supabase user id only. Do not add email, phone, restaurant names, or other custom sensitive identity properties.

## Client analytics and replay

- `lib/posthog/provider.tsx` initializes `posthog-js` on the client with:
  - manual `$pageview` capture via `src/instrumentation-client.ts`
  - `autocapture: true` for click, rage-click, and heatmap use cases
  - `capture_pageleave: true`
  - `person_profiles: 'identified_only'`
  - URL and noisy-exception filtering through `lib/posthog/error-filter.ts`
- Session replay, heatmaps, web vitals, and error autocapture still require the matching PostHog project settings to be enabled in the PostHog UI.
- Custom browser events must go through `track()` in `lib/analytics.ts` so event names and properties stay allowlisted and privacy-safe.

## Server analytics, error capture, and feature flags

Use `lib/posthog/server.ts` for server-side PostHog calls:

```ts
import {
  captureServerEvent,
  captureServerException,
  flushPosthogServerClient,
  isServerFeatureEnabled,
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

const enabled = await isServerFeatureEnabled('reserve-v2', {
  distinctId: user.id,
  fallback: false,
});

await flushPosthogServerClient();
```

Guidelines:

- Prefer a stable Supabase user id as `distinctId` when one is available.
- Use the privacy-safe server default only for system/background events where no user exists.
- Pass only allowlisted analytics properties; emails, phone numbers, tokens, raw URLs with query strings, restaurant names, and provider secrets are intentionally dropped or stripped.
- In route handlers and serverless jobs, flush after critical events or use `after()` to flush after the response.
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

| Event                                                 | Where emitted                                                                  | Client/Server               | distinctId                           | Allowed properties                                                  | Privacy notes                                                   | QA command                                      |
| ----------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------- | ------------------------------------ | ------------------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------- |
| `booking_create_started`                              | `server/bookings/bookings-post-response.ts`                                    | server                      | server:&lt;env&gt; (public)          | restaurantId, source                                                | restaurant group                                                | `qa:public-booking:api`                         |
| `booking_created`                                     | `server/bookings/create-completion.ts`                                         | server (also client wizard) | server:&lt;env&gt;                   | bookingId, restaurantId, source, idempotent                         | restaurant group                                                | `qa:public-booking:api`                         |
| `booking_duplicate_prevented`                         | `server/bookings/create-completion.ts`                                         | server                      | server:&lt;env&gt;                   | bookingId, restaurantId, source                                     | emitted when idempotent reuse                                   | `qa:public-booking:api`                         |
| `booking_capacity_rejected`                           | `server/bookings/capacity-failure-response.ts`                                 | server                      | server:&lt;env&gt;                   | restaurantId, code, source, reason                                  | reason ∈ {capacity_full, conflict}                              | `qa:public-booking:api`                         |
| `booking_create_failed`                               | `server/bookings/create-failure-response.ts`                                   | server                      | server:&lt;env&gt;                   | restaurantId, code, status, source                                  | + captureServerException                                        | `qa:public-booking:api`                         |
| `availability_slots_loaded`                           | `src/app/api/availability/route.ts`                                            | server                      | server:&lt;env&gt;                   | restaurantId, available, slotCount, source                          | counts only, no times                                           | `qa:public-booking:api`                         |
| `availability_no_slots_shown`                         | `src/app/api/availability/route.ts`                                            | server                      | server:&lt;env&gt;                   | restaurantId, source                                                | restaurant group                                                | `qa:public-booking:api`                         |
| `availability_request_failed`                         | `src/app/api/availability/route.ts`                                            | server                      | server:&lt;env&gt;                   | source, path                                                        | + captureServerException                                        | `qa:public-booking:api`                         |
| `booking_modify_started` / `_failed`                  | `src/app/api/bookings/[id]/route.ts`, `src/app/api/ops/bookings/[id]/route.ts` | server                      | user.id (auth) or server:&lt;env&gt; | bookingId, restaurantId, source, method, code/status/reason         | reason is an enum; `_failed` adds captureServerException on 5xx | `qa:public-booking:api`, `qa:ops-lifecycle:api` |
| `booking_cancel_started` / `_failed`                  | `src/app/api/bookings/[id]/route.ts`, `src/app/api/ops/bookings/[id]/route.ts` | server                      | user.id (auth) or server:&lt;env&gt; | bookingId, restaurantId, source, method, reason                     | reason ∈ {cutoff_passed, unexpected}                            | `qa:public-booking:api`, `qa:ops-lifecycle:api` |
| `table_assignment_started` / `_completed` / `_failed` | `src/app/api/ops/bookings/[id]/assign-tables/route.ts`                         | server                      | user.id                              | bookingId, restaurant_id, source, assignedCount, kind, code, reason | `kind` records the `ops-table-assignment-v2` flag decision      | `qa:capacity-tables:api`                        |
| `email_delivery_retry_clicked`                        | `src/components/features/email-delivery/useOpsEmailDeliveryRetryState.ts`      | client                      | identified user                      | provider, source                                                    | no recipient, no log id                                         | `qa:customers-delivery:api`                     |
| `email_delivery_retry_failed`                         | retry route + client hook                                                      | both                        | user.id (server)                     | provider, source, reason                                            | no recipient, no log id                                         | `qa:customers-delivery:api`                     |
| `gbp_authorization_started` / `_failed`               | `src/app/api/ops/restaurants/[id]/google-business-profile/connect/route.ts`    | server                      | access.userId                        | restaurantId, source                                                | + captureServerException                                        | `qa:gbp-dual-sync:api`                          |
| `gbp_publish_started` / `_completed` / `_failed`      | `.../google-business-profile/drafts/[draftId]/publish/route.ts`                | server                      | access.userId                        | restaurantId, draftId, source, status                               | + captureServerException                                        | `qa:gbp-dual-sync:api`                          |
| `restaurant_profile_section_save_failed`              | `src/app/api/ops/restaurants/[id]/route.ts`                                    | server (also client editor) | user.id                              | restaurantId, section, source                                       | + captureServerException                                        | —                                               |
| `reserve_step_viewed`                                 | `reserve/.../hooks/useReservationWizard.ts`                                    | client (Plausible-only)     | —                                    | step                                                                | see reserve note below                                          | `qa:reserve-app:api`                            |
| `reserve_submit_failed`                               | `reserve/.../api/useCreateReservation.ts`                                      | client (Plausible-only)     | —                                    | reason                                                              | see reserve note below                                          | `qa:reserve-app:api`                            |

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
receives events. `reserve_submit_failed` is additive to the canonical `wizard_submit_failed`.

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
- `kind`: lifecycle label (`check-in`/`check-out`/...) or flag decision (`v1`/`v2`)

### Suggested PostHog feature flags

These server flags are evaluated via `isFeatureEnabledWithFallback` in
`lib/posthog/feature-flags.ts`. PostHog wins when configured; otherwise the caller's
env/local fallback applies, so existing behavior is preserved when a flag is undefined.
They are defined in PostHog project `120939` as disabled Boolean flags:

- `reserve-v2`
- `new-booking-wizard`
- `ops-table-assignment-v2` (wired in the ops table-assignment route; currently records the
  decision as `kind` and defaults to current behavior — the divergent branch lands with the
  feature itself)
- `gbp-dual-sync-rollout`
- `sms-delivery-rollout`

```ts
import { isFeatureEnabledWithFallback } from '@/lib/posthog/feature-flags';

const enabled = await isFeatureEnabledWithFallback('ops-table-assignment-v2', {
  distinctId: user.id,
  groups: { restaurant: restaurantId },
  fallback: false, // pass the existing env flag value here
});
```

## Live project state (verified via PostHog UI, 2026-06-09, project 120939)

Confirmed already flowing in production (no action needed):

- **Client ingestion is live** — custom events (`auth_*`, `booking_*`, `restaurant_profile_*`,
  `user_signed_up`, `client_error_reported`) and autocapture are arriving.
- **Session replay is active** — recordings captured today on both the public booking page
  (`nabatable.com/restaurants/.../book`) and the ops app (`app.nabatable.com`).
- **Web vitals** (`$web_vitals`), **rageclicks** (`$rageclick`), **dead clicks**
  (`$dead_click`), **exception autocapture** (`$exception`), and **CSP reports**
  (`$csp_violation`) are all flowing.

Remaining deployment-dependent setup:

- **Feature flags are defined and disabled.** PostHog UI readback shows `reserve-v2`,
  `new-booking-wizard`, `ops-table-assignment-v2`, `gbp-dual-sync-rollout`, and
  `sms-delivery-rollout` with release conditions `No users` and status `Disabled`.
- New **server-side** events (`booking_create_*`, `availability_*`, `table_assignment_*`,
  `gbp_*`, server exceptions) will appear once this code is deployed — they were not present
  at the time of verification because the change was not yet released.

## Logs

- `src/instrumentation.ts` registers an OpenTelemetry log exporter for the Node runtime when PostHog env vars are present.
- `lib/logger.ts` keeps writing sanitized JSON to the console and also emits sanitized structured records to OpenTelemetry/PostHog Logs.
- Log export is disabled automatically when no PostHog project token/host is configured.
- For short-lived route handlers, call `flushPosthogLogs()` from `src/instrumentation.ts` via `after()` when a log must be delivered before the serverless function freezes.

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
