# User Testing

Testing surface, required testing skills/tools, resource cost classification per surface.

---

## Validation Surface

- **Primary surface**: Browser at `http://app.localhost:3000/email-delivery`
- **Tool**: agent-browser (headless Chromium)
- **Authentication**: Password login at `http://app.localhost:3000/auth/signin`
  - Email: `oldcrown@lapeninns.com`
  - Password: `OldCrown@2025`
- **Dev harness**: `http://localhost:3000/dev/ops-email-delivery` (intended no-auth mock surface), but in this mission's local env it may return `404` when `APP_ENV=staging` causes `enforceDevOnly()` to block public dev routes. If that happens, use the authenticated primary surface above instead.
- **Dev server**: Already running on port 3000 (`pnpm dev`)

## Validation Concurrency

- Machine: 64GB RAM, 18 CPU cores, ~30GB free headroom
- Per agent-browser instance: ~300MB RAM
- Dev server: ~200MB RAM (shared, already running)
- Max concurrent validators: **5** (5 × 300MB = 1.5GB, well within 70% of 30GB = 21GB budget)

## Flow Validator Guidance: browser

- Use authenticated `http://app.localhost:3000/email-delivery` for this milestone because the public dev harness may be unavailable under `APP_ENV=staging`.
- Always log in through `http://app.localhost:3000/auth/signin` with the documented validator credentials, then navigate directly back to `/email-delivery` because successful sign-in currently redirects to `/dashboard`.
- Keep each validator within its assigned browser session and assertion set; do not mutate unrelated tabs or restaurant context outside the assigned flow.
- For Delivery Log error-state validation, use the canonical forced-error triggers supported in this milestone: `messageId=__force_error__` and `simulateEmailDeliveryError=1`.

## Queue-and-Analytics Assertion Routing (Reruns)

- For `VAL-Q-006`, `VAL-AN-004`, and `VAL-CROSS-006`, use the restored dev harness at `http://localhost:3000/dev/ops-email-delivery` as the primary validation surface (it exposes deterministic queue/analytics controls and multi-restaurant switcher options).
- `VAL-AN-004` precondition: a direct URL with `tab=delivery-log&page=2` is an acceptable page-2+ starting state for independence validation, even if live dataset pagination controls are disabled.
- `VAL-CROSS-006`: validate restaurant switch reset/reload using the harness switcher (`Dev Restaurant` → `Second Dev Restaurant`) and capture before/after screenshots plus URL/query evidence.

## Actions-and-Realtime Deterministic Fixtures

- For `VAL-ACT-001` through `VAL-ACT-005`, use the authenticated surface at `http://app.localhost:3000/email-delivery?restaurantId=<active-membership-restaurant-id>&fixture=retry-actions`.
- The `fixture=retry-actions` query param is dev/test-safe and only affects authenticated email-delivery validation flows. It injects deterministic delivery-log rows so validators always get:
  - one `failed` row with a visible row-level **Retry** button,
  - one `bounced` row with a visible row-level **Retry** button,
  - one non-retryable `delivered` row without a Retry button.
- The fixture rows use real delivery-log UUIDs so the confirmation dialog and `POST /api/ops/email-delivery/retry` mutation path can be exercised end-to-end from the table UI.
- For retry success validation, keep `fixture=retry-actions` and click a failed/bounced row Retry button, confirm the dialog, and verify the success toast plus delivery-log refetch.
- For retry error validation, use `fixture=retry-actions&simulateRetryMutationError=1`; this keeps the retryable rows visible but forces the row-level retry mutation to fail so the error toast can be observed without changing live data.
- For `VAL-Q-006`, use `http://app.localhost:3000/email-delivery?restaurantId=<active-membership-restaurant-id>&tab=queue&queueFixture=loading` and switch away/back to Queue or click Refresh. The fixture holds the queue request long enough for the visible `Loading email queue` skeleton / `Refreshing queued jobs…` indicator to appear deterministically.
