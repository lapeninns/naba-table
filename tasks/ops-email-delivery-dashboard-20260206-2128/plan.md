---
task: ops-email-delivery-dashboard
timestamp_utc: 2026-02-06T21:28:53Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Implementation Plan: Ops Email Delivery Deliverability Dashboard (`/app/email-delivery`)

## Objective

Rebuild the Ops Email Delivery page into a deliverability dashboard with attempt-level semantics, server-computed KPIs, and scalable query performance.

## Success Criteria

- [ ] Attempt list is keyed by `(messageId, recipientEmail)` and expandable into an ordered timeline.
- [ ] `status` filter applies to **current attempt status** (latest event), not raw log rows.
- [ ] Backend includes `summary` on `page=1` only; summary matches the active filters and search.
- [ ] UI shows KPI tiles + distribution bar + “More metrics”, with non-blocking failure states.
- [ ] Page remains shareable via URL params and keeps `page/pageSize`.
- [ ] A11y: keyboard navigation works; expand/collapse announces state.
- [ ] Performance: DB query plan uses the new composite index; no client-side aggregation over full result sets.

## Architecture & Components

- **DB**
  - Migration adds:
    - Composite index on `email_delivery_log (restaurant_id, occurred_at desc, id desc)`
    - RPC functions:
      - `public.ops_email_delivery_attempts_feed(...)` returning attempt rows + `events jsonb`
      - `public.ops_email_delivery_attempts_summary(...)` returning attempt-level KPI summary

- **Backend**
  - `server/emails/email-delivery-log.ts`:
    - `listEmailDeliveryAttemptsForRestaurant(...)` -> `rpc('ops_email_delivery_attempts_feed', ...)`
    - `getEmailDeliveryAttemptsSummary(...)` -> `rpc('ops_email_delivery_attempts_summary', ...)`
  - `src/app/api/ops/email-delivery/route.ts`:
    - Membership/auth unchanged
    - Response shape becomes attempt-based
    - Summary failure is non-fatal (omit `summary`)

- **Frontend**
  - `OpsEmailDeliveryClient` is rebuilt:
    - header + filters + summary metrics + attempt results
  - New components:
    - `OpsEmailDeliverySummaryMetrics`
    - `OpsEmailDeliveryAttemptCard`
  - Filters card updated with robust search parsing and optional status counts (from summary).

## Data Flow & API Contracts

Endpoint: `GET /api/ops/email-delivery`

Query params (existing names preserved):

- `restaurantId`, `range`, `page`, `pageSize`
- `status` (comma-separated): now means current attempt status
- `recipientEmail`, `messageId`, `bookingRef`, `templateType`, `emailType`

Response (new shape):

- `ok: true`
- `attempts: OpsEmailDeliveryAttemptDTO[]`
- `pageInfo: { page, pageSize, hasNext }`
- `summary?: OpsEmailDeliverySummary` (only when `page === 1`)

Errors:

- `DELIVERY_LOG_UNAVAILABLE` (503) preserved
- Summary failure does not fail the route; omit `summary`

## UI/UX States

- Loading:
  - keep previous data during filter changes to avoid flicker
  - show subtle “Updating…” indicator for summary section
- Empty:
  - no attempts -> empty state with filter reset affordance
- Error:
  - delivery log unavailable -> existing 503-safe state
  - summary unavailable -> inline alert “Metrics unavailable” (list still visible)

## Edge Cases

- Message IDs are not UUIDs (e.g., Resend `msg-...`): search parser must recognize and route correctly.
- Attempts with only `sent` events: current status is `sent` and delivery-time percentiles exclude these.
- Multiple statuses supplied: current status is `IN (...)`.
- Time range boundaries must be applied identically across feed and summary.

## Testing Strategy

- Unit:
  - Search parser tests
  - Summary metrics rendering tests
- E2E (Playwright dev harness):
  - Load dashboard, validate KPIs, apply status filter, ensure list and KPIs update.
- Manual QA (Chrome DevTools MCP):
  - `/dev/ops-email-delivery` and `/app/dev/ops-email-delivery` (base-path validation)
  - console/network/a11y/perf evidence captured in `artifacts/`

## Rollout

- Apply Supabase migration:
  - staging first (dry-run diff evidence)
  - production in a change window
- Deploy app changes (always-on; no feature flag)
- Monitor API error rate + latency for `/api/ops/email-delivery`

## DB Change Plan

- Migration file: `supabase/migrations/<UTC_TIMESTAMP>_ops_email_delivery_attempts_dashboard.sql`
- Rollback:
  - `DROP FUNCTION public.ops_email_delivery_attempts_feed(...)`
  - `DROP FUNCTION public.ops_email_delivery_attempts_summary(...)`
  - `DROP INDEX public.email_delivery_log_restaurant_occurred_at_id_idx`
