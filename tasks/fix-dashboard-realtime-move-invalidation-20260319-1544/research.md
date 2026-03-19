---
task: fix-dashboard-realtime-move-invalidation
timestamp_utc: 2026-03-19T15:44:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Fix dashboard realtime move invalidation

## Requirements

- Functional:
  - Keep the ops dashboard summary in sync when a booking is moved off the currently viewed date.
  - Keep the ops dashboard summary in sync when a booking is moved into the currently viewed date.
  - Preserve existing realtime invalidation behavior for normal booking updates, table-assignment changes, and customer-profile changes.
- Non-functional (a11y, perf, security, privacy, i18n):
  - No new network surfaces or auth changes.
  - No broadening of realtime invalidation beyond the affected restaurant/date unnecessarily.
  - Keep the fix narrowly scoped and regression-testable.

## Existing Patterns & Reuse

- `src/hooks/ops/useOpsTodaySummary.ts` already centralizes summary realtime subscriptions.
- `src/utils/ops/realtimeInvalidation.ts` already isolates subscription-scoped debounced invalidation behavior.
- The current bug comes from the local realtime payload matching helper preferring `new` over `old`.

## Constraints & Risks

- Supabase `postgres_changes` booking update payloads can include both `old` and `new` row values.
- For move operations, the source dashboard must invalidate if either the previous or next row matches the active restaurant/date.
- The fix should not accidentally over-invalidate unrelated restaurants or dates.

## Open Questions (owner, due)

- Q: Should this be fixed inline or by extracting a pure helper for testing?
  A: Prefer a small pure helper extraction if it makes payload-matching behavior directly testable without overcomplicating the hook.

## Recommended Direction (with rationale)

- Replace the single-value `new ?? old` lookup with logic that can inspect both payload identities.
- Invalidate when either the previous row or next row belongs to the active restaurant/date.
- Add focused regression coverage around the payload matching rule so the moved-booking case is locked down.
