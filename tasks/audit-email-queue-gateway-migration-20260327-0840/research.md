---
task: audit-email-queue-gateway-migration
timestamp_utc: 2026-03-27T08:40:58Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: [FEATURE_EMAIL_QUEUE_ENABLED]
related_tickets: []
---

# Research: Durable Object Email Queue Gateway Audit

## Requirements

- Functional:
  - Audit the remaining Cloudflare Durable Object email queue gateway.
  - Document the exact responsibilities that still live in `server/queue/email.ts` and `cloudflare/email-queue-gateway/src/index.mjs`.
  - Cover enqueue/dequeue flow, retry behavior, rate limiting, failure handling, and migration assumptions.
  - Produce a concrete gap analysis for migration to native Cloudflare Queues plus Worker consumers.
- Non-functional (a11y, perf, security, privacy, i18n):
  - No UI or schema changes.
  - Do not expose gateway or cron secrets.
  - Recommendations must preserve reliability, idempotency, and operator visibility where still needed.

## Existing Patterns & Reuse

- The app-side queue contract is centralized in `server/queue/email.ts`.
- Actual email delivery stays in the Next.js app via `/api/cron/process-emails` and `server/queue/email-processing.ts`.
- The Cloudflare Worker is not email-only: it also hosts distributed rate limiting and capacity-cache version coordination.
- Ops/admin queue visibility depends on the gateway status API, not on Cloudflare Queues-native tooling.

## External Resources

- Cloudflare Queues limits: <https://developers.cloudflare.com/queues/platform/limits/>
  - Current docs say message retries are capped at 100 and `delaySeconds` is capped at 24 hours.
- Cloudflare Queues delivery guarantees: <https://developers.cloudflare.com/queues/reference/delivery-guarantees/>
  - Current docs say delivery is at-least-once and consumers must stay idempotent.
- Cloudflare dashboard queue preview: <https://developers.cloudflare.com/queues/examples/list-messages-from-dash/>
  - Current docs describe dashboard preview/ack workflows, but not an app-facing status API equivalent to the current gateway.

## Code Inventory

### `server/queue/email.ts`

- Defines the app-facing queue contract and payload shape:
  - `EmailJobType`, `EmailJobPayload`
  - queue names `pending-booking-emails` and `pending-booking-emails-dlq`
  - job summary / status / drain response DTOs consumed by admin and ops routes
- Builds deterministic job IDs:
  - `email__<type>__<bookingId>` by default
  - replaces `:` with `__` so upstream callers can still pass ids such as `review_request:<bookingId>`
- Owns producer-side enqueue semantics:
  - default job attempts: `5`
  - default backoff: exponential, base `60_000ms`
  - producer HTTP retry loop: `3` attempts with `50ms`, `100ms`, `200ms` exponential waits
  - duplicate enqueue is treated as success when gateway returns `409`, `{ duplicate: true }`, `{ status: "duplicate" }`, or an error message containing `duplicate`
- Owns queue-control RPCs:
  - `enqueueEmailJob()` -> `POST /messages`
  - `removeEmailJob()` -> `DELETE /messages/:id`
  - `getEmailQueueStatus()` -> `GET /status`
  - `triggerEmailQueueDrain()` -> `POST /drain`
- Owns enqueue failure observability:
  - logs `[queue][email] failed to add job`
  - records `email_queue.enqueue_failed` through `recordObservabilityEvent`

### `cloudflare/email-queue-gateway/src/index.mjs`

- Contains three Durable Objects in one Worker deployment:
  - `EmailQueueState`
  - `RateLimitState`
  - `CapacityVersionState`
- Routes top-level authenticated gateway traffic:
  - `/messages`, `/messages/:id`, `/status`, `/drain` -> `EMAIL_QUEUE_STATE`
  - `/rate-limit/consume` -> `RATE_LIMIT_STATE`
  - `/capacity/versions/bump`, `/capacity/versions/read` -> `CAPACITY_VERSION_STATE`
- Adds global auth and CORS behavior:
  - bearer auth via `GATEWAY_TOKEN`
  - permissive CORS headers for all handled responses

## Detailed Responsibilities

### Email enqueue / schedule state (`EmailQueueState`)

- Persists queued jobs under `job:<jobId>`.
- Persists schedule index entries under `schedule:<scheduledAt>:<jobId>`.
- Persists dead-letter records under `dlq:<jobId>`.
- Persists aggregate metadata under `meta` with `completedCount`.
- Detects duplicates across both active queue state and DLQ state:
  - if `job:<id>` exists -> duplicate
  - if `dlq:<id>` exists -> duplicate
  - if the job completed successfully earlier and was deleted from both places, the same id can be enqueued again
- Converts delayed jobs into DO alarms:
  - every enqueue updates the next alarm
  - `alarm()` drains due work with `DEFAULT_MAX_JOBS = 25`
- Implements queue status introspection:
  - waiting / active / delayed / failed(dlq) counts
  - optional job listings with configurable limit or `all`

### Email drain / processing orchestration (`EmailQueueState`)

- Selects due jobs by scanning `schedule:` keys in lexicographic timestamp order.
- Hard scan ceiling: `MAX_SCAN = 200` scheduled entries per drain invocation.
- Hard execution batch cap:
  - default via alarm: 25 jobs
  - manual `/drain` requests: caller value normalized to `1..100`
- Marks each selected job `active`, deletes its schedule key, then sends a batch callback to:
  - `APP_PROCESS_EMAILS_URL`
  - authenticated with `APP_PROCESS_EMAILS_TOKEN`
- Expects the app callback to return:
  - `success === true`
  - per-job `results`
  - batch `stats`
- Converts callback outcomes into queue state transitions:
  - success -> delete `job:<id>`, increment `completedCount`
  - failure with attempts remaining -> requeue with computed backoff
  - failure with no attempts remaining -> move to `dlq:<id>`

### Retry behavior in the Durable Object

- Per-job attempt tracking starts from:
  - `payload.cronAttemptsMade` if present and valid
  - otherwise `0`
- Next attempt count is `attemptsMade + 1`.
- Terminal failure rule:
  - if `nextAttempt >= job.attempts`, move to DLQ
- Retry delay rule:
  - if `backoff.type === "fixed"`, always reuse `backoff.delay`
  - otherwise exponential backoff: `baseDelay * 2^(attempt-1)`
  - capped at `30 minutes`
- Retry metadata is written back into the payload itself:
  - `cronAttemptsMade`
  - `failedReason`
  - `failedAt`

### Failure handling in the Durable Object

- If the batch callback request fails or returns non-success, the gateway fabricates a failure result for every selected job.
- If the callback omits a result for a selected job, the gateway treats that as a failure with `Missing processing result`.
- If a scheduled entry exists without a matching job record, the schedule entry is deleted silently.
- If a job is filtered out by `/drain.types`, it stays scheduled; only matching due jobs are consumed in that drain call.
- Status reporting treats DLQ contents as both `failed` and `dlq`.

### Rate limiting (`RateLimitState`)

- This is unrelated to email delivery but still lives in the same Worker deployment.
- Implements a fixed-window counter per `identifier`.
- Persists one bucket per Durable Object instance:
  - keyed by DO name = limiter identifier
  - payload: `windowStart`, `count`, `resetAt`
- Returns `{ ok, limit, remaining, resetAt, source: "cloudflare" }`.
- Is consumed broadly by auth and booking APIs through `server/security/rate-limit.ts`.

### Capacity cache versioning (`CapacityVersionState`)

- Also unrelated to email delivery but still coupled to the same Worker deployment.
- Stores per-restaurant inventory (`inv`) and adjacency (`adj`) version counters.
- Supports:
  - `/capacity/versions/bump`
  - `/capacity/versions/read`
- Is consumed by `server/capacity/cache.ts` to coordinate cache invalidation across app instances.

## Actual App Flow Today

### Enqueue flow

1. Booking side-effect code decides a reminder or review email should be delayed.
2. `server/jobs/booking-side-effects.ts` computes the final send delay, including "smart scheduling" into preferred hours.
3. `enqueueEmailJob()` posts the job to the gateway with:
   - deterministic job id
   - queue and DLQ names
   - delay
   - attempts/backoff
   - payload
4. `EmailQueueState.handleEnqueue()` writes the job and its schedule entry, then sets the next alarm.

### Dequeue / processing flow

1. A DO alarm fires, or an operator/script calls `/drain`.
2. `processDueJobs()` scans due `schedule:` records, promotes matching jobs to `active`, and removes their schedule keys.
3. The DO calls back into the app at `APP_PROCESS_EMAILS_URL`.
4. The app route `/api/cron/process-emails` validates the batch and runs `processEmailJobs()`.
5. `server/queue/email-processing.ts`:
   - fetches the booking from Supabase
   - skips missing bookings, invalid emails, or no-longer-applicable statuses
   - dispatches the actual Resend-backed booking email
6. The DO translates the per-job batch response into success, retry, or DLQ state.

### Dequeue / deletion flow

- `removeEmailJob()` only deletes queued-but-not-yet-processed jobs through `DELETE /messages/:id`.
- Current repo usage is limited to the smoke test script; no production route currently uses it.

## Important Assumptions That Affect Migration

- The queue is only used today for delayed reminder and review-request email scheduling.
  - Other job types exist in the payload schema and consumer, but they are not currently enqueued by application code.
- The current system depends on long-lived schedule state, not just short queue delays.
  - `reminder_24h` can be enqueued at booking creation time, which may be more than 24 hours before delivery.
- The current system assumes a callback into the app is the delivery boundary.
  - The Worker does not send email itself.
  - The app remains the source of truth for booking lookup, send/skip decisions, and email template dispatch.
- The current system assumes idempotent-at-least-once processing.
  - Deterministic job ids reduce duplicate enqueue.
  - Consumer code still must tolerate replay because Cloudflare Queues is also at-least-once.
- The current worker deployment is operationally overloaded.
  - Email queueing, rate limiting, and capacity cache invalidation share one gateway URL, token, deployment lifecycle, and rollback path.
- Queue introspection is productized.
  - Admin and ops app routes depend on `getEmailQueueStatus()` returning full counts and per-job details.
- Queue deletion by id is currently available, even if only used by smoke tests.
- The worker secret contract is external and implicit.
  - `GATEWAY_TOKEN`, `APP_PROCESS_EMAILS_URL`, and `APP_PROCESS_EMAILS_TOKEN` are required at runtime but are not declared in-repo in `wrangler.jsonc`.

## Gap Analysis: Durable Object Gateway vs Native Cloudflare Queues

### What native Cloudflare Queues can replace directly

- Message storage and delivery scheduling for jobs that fit Queue limits.
- Consumer invocation in a Worker instead of the current DO alarm + callback loop.
- Native retry and DLQ behavior at the queue layer.
- Queue-level metrics and manual message preview/ack from the Cloudflare dashboard.

### What native Cloudflare Queues does not replace by itself

- Delays longer than 24 hours.
  - This is the biggest functional gap for `reminder_24h` when bookings are created well in advance.
- App-facing queue status APIs used by `/api/admin/queue-status` and `/api/ops/email-queue`.
- Delete-by-job-id semantics for scheduled jobs.
- Restaurant-specific filtering and booking enrichment of queued jobs.
- Shared Worker features unrelated to email (`RateLimitState`, `CapacityVersionState`).

### Migration blockers / decisions

- If the product still needs 24-hour reminders queued at booking creation time, a pure "enqueue once into native Queue with delay" migration is insufficient.
- If ops must keep the in-app queue panel, native Queue metrics/dashboard are not enough; some app-readable job ledger must remain.
- If rollback blast radius should shrink, the email queue should be separated from rate limiting and capacity cache coordination.

## Recommendation

### Can be removed

- The HTTP queue-bridge contract in `server/queue/email.ts`:
  - `requestCloudflareGateway('/messages' | '/status' | '/drain')`
  - producer-side HTTP retry loop
  - gateway-specific duplicate-response parsing
- `EmailQueueState` as the primary transport/scheduler for jobs whose delay is within native Queue limits.
- `triggerEmailQueueDrain()` and the current GET `/api/cron/process-emails` drain path once a Queue consumer Worker owns dequeue.
- `removeEmailJob()` unless the product decides queued-job cancellation must remain a supported feature.

### Must be preserved somewhere

- Booking-level email processing rules from `server/queue/email-processing.ts`:
  - fetch booking
  - skip invalid or stale sends
  - dispatch correct template
- Deterministic idempotency strategy for message identity.
- Observability for enqueue and processing failure.
- A solution for delays beyond 24 hours.
  - likely a scheduler/ledger, not just native Queue delay
- Any operator-facing job visibility the app still requires.
- Non-email Durable Object services:
  - `RateLimitState`
  - `CapacityVersionState`

### Concrete migration shape

- Split the current Worker responsibilities first:
  - keep rate limiting and capacity-version DOs on their own Worker/deployment
  - stop treating the email queue worker as a shared gateway
- Move email transport to native Cloudflare Queues plus a consumer Worker.
- Preserve the existing app-side business logic by either:
  - calling the app route from the consumer Worker during transition, or
  - moving `server/queue/email-processing.ts` logic into a shared library the consumer can run directly
- Add a separate scheduling mechanism for `delay > 24h` jobs:
  - recommended: store future email schedules in the app database, then a cron/Worker promotes jobs into Cloudflare Queue once they are within the 24-hour delay window
- Decide explicitly whether the app queue UI still matters:
  - if yes, keep a DB-backed job ledger
  - if no, remove `/api/admin/queue-status`, `/api/ops/email-queue`, and gateway status DTOs

## Recommended Direction

- Preserve:
  - email-processing business rules
  - idempotent job identity
  - long-delay scheduling capability
  - rate-limit and capacity-version services, but on separate infrastructure from email
- Remove:
  - the Durable Object email scheduler itself
  - gateway-specific HTTP bridge code in `server/queue/email.ts`
  - manual drain endpoints once a native Queue consumer is live
- Do not attempt a one-step "swap DO for Queue" migration for all jobs.
  - Move short-delay jobs first.
  - Replace long-delay reminder scheduling with a scheduler/ledger pattern before deleting the DO path.
