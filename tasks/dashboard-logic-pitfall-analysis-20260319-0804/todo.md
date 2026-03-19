---
task: dashboard-logic-pitfall-analysis
timestamp_utc: 2026-03-19T08:04:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Create task folder and task artifacts
- [x] Identify applicable AGENTS.md files for touched dashboard codepaths

## Core

- [x] Trace dashboard server route composition
- [x] Trace dashboard client state and derived selectors
- [x] Trace query keys, invalidation, and mutation side effects
- [x] Reproduce or infer the logic pitfall with concrete evidence
- [x] Patch the live dashboard mismatch between requested date/restaurant and placeholder summary data
- [x] Patch stale summary invalidation gaps for booking-detail realtime and table assignment routes
- [x] Canonicalize active restaurant resolution across server layout, SSR prefetch, cookie persistence, and client session hydration
- [x] Canonicalize implicit “today” handling so the dashboard keeps a single cache identity when no explicit date is selected
- [x] Reconcile the filter contract by surfacing `attention` in the toolbar and normalizing legacy `completed` URLs to `finished`
- [x] Tighten dashboard realtime subscriptions to relevant booking/customer scope instead of whole-table invalidation
- [x] Centralize dashboard cache invalidation for booking mutations and apply it to booking update/cancel flows
- [x] Align dashboard changes feed date handling with restaurant-local day bounds and an actually optional `date` parameter

## UI/UX

- [x] Validate dashboard state transitions and route/query-param behavior

## Tests

- [x] Determine existing automated coverage for dashboard logic
- [x] Add or update tests if a code fix is implemented

## Notes

- Assumptions:
  - The dashboard changes feed should continue to represent changes by `changed_at`, but the day window must be interpreted in the restaurant timezone.
- Deviations:
  - `CONTINUITY.md` already has unrelated local edits, so continuity notes are being captured in this task folder instead of modifying that shared file.
  - Browser QA could not reach the dev harness in the current runtime (`app.localhost` redirected to auth; `localhost` returned 404 for dev-only routes), so verification stayed automated plus HTTP-level.

## Batched Questions

- None at the moment.
