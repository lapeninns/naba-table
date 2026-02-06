---
task: ops-email-delivery-dashboard
timestamp_utc: 2026-02-06T21:28:53Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Research: Ops Email Delivery Deliverability Dashboard

## Requirements

- Functional:
  - `/app/email-delivery` is a deliverability dashboard (KPI-first), not a raw audit log.
  - Attempt-level semantics: one attempt = unique `(messageId, lower(recipientEmail))` scoped to `restaurant_id`.
  - Results are page-based (`page`, `pageSize`) with shareable URL filters.
  - Each attempt row is expandable to show a timeline (sent -> delayed -> delivered, etc).
  - `status=` filter applies to the attempt **current status** (latest event), not raw events.
  - Backend returns `summary` (page 1 only) computed server-side and consistent with active filters.
  - Failure modes:
    - summary fails: list still loads; KPI area shows "Metrics unavailable" (non-blocking)
    - delivery log unavailable: preserve existing 503-safe UI state

- Non-functional:
  - Performance: queries must scale for >1000 users / large volumes without client-side aggregation.
  - Accessibility: keyboard navigation and expand/collapse controls with correct ARIA.
  - No new third-party dependencies and no changes to the email sending workflow.

## Existing Patterns & Reuse

- Existing Ops Email Delivery page exists and already uses:
  - filters in URL, server API boundary with membership checks, and dev harness route.
  - event-level listing from `email_delivery_log` and client-side grouping into attempts.
- Prior implementation task: `tasks/ops-email-delivery-page-20260205-2356/` documents the current architecture.

## Data/DB Context

- `public.email_delivery_log` exists with a uniqueness constraint on `(message_id, recipient_email, status)`.
  - This bounds per-attempt event rows (generally ~6 statuses max), making a lateral `jsonb_agg` feasible.

## Constraints & Risks

- Supabase is remote-only; migrations must be applied staging-first, then production in a change window.
- Attempt-level status filtering and KPI computation must be server-side to avoid incorrect metrics.
- New SQL functions must be permissioned safely (avoid PUBLIC execute; prefer service-role access via API).

## Open Questions (owner, due)

- None for implementation (spec is decision-complete). Operationally, staging/prod apply windows and rollback evidence must be captured during rollout.

## Recommended Direction (with rationale)

- Implement Postgres RPC functions for attempt feed + summary to guarantee correctness, reduce transfer size, and keep API simple.
- Add composite index matching the feed access pattern `(restaurant_id, occurred_at DESC, id DESC)` for fast filtering/sorting.
- Rebuild UI around attempt DTOs and summary metrics, keeping URL shareability and existing dev harness QA path.
