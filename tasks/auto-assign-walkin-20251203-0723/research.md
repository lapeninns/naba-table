---
task: auto-assign-walkin
timestamp_utc: 2025-12-03T07:23:13Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Walk-in auto-assign not triggered

## Requirements

- Functional:
  - When a walk-in booking is created from the restaurant-facing (ops) UI, the auto-assign job should run and either confirm the booking or raise a clear pending-admin outcome.
  - Logs/telemetry should show the attempt lifecycle (`attempt.start`, `attempt.no_hold`, `attempt.success`/`failed`) so ops staff can observe outcomes.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Reliability of fire-and-forget execution in API routes; avoid silent failures.
  - Keep ops UI latency reasonable (avoid long blocking waits).

## Existing Patterns & Reuse

- `autoAssignAndConfirmIfPossible` in `server/jobs/auto-assign.ts` drives background assignment; logs via `[auto-assign][job] ...` and writes observability events.
- Ops walk-ins hit `src/app/api/ops/bookings/route.ts` (middleware rewrites `/api/bookings` → `/api/ops/bookings` for the app host) and already call `autoAssignAndConfirmIfPossible` when `isAutoAssignOnBookingEnabled()` is true (both legacy and unified validation paths).
- Observability events table captures `auto_assign.started` etc.; bookings rows include `auto_assign_idempotency_key`.

## External Resources

- `docs/restaurant-facing-routes.md` — confirms the rewrite to `/api/ops/bookings` for restaurant-facing traffic.
- `docs/auto-assignment-RESOLVED.md` / `docs/auto-assignment-failure-analysis.md` — prior investigations into auto-assign behaviour and limits.

## Constraints & Risks

- Feature flag dependency (`autoAssignOnBooking`).
- Fire-and-forget background tasks in API routes may be terminated in serverless environments; unexpected errors today only surface in console logs.
- Need to avoid regressions for guest-facing booking flows.

## Open Questions (owner, due)

- Q: What error (if any) occurs after `auto_assign.started` for ops walk-ins (e.g., booking `1f37be1a-8e01-40f2-a9f3-38c8e15a2170`)? (owner: us)
- Q: Is the auto-assign job hanging or exiting before the attempt loop (no `attempt.start` logs observed)? (owner: us)
- Q: Are background jobs being cut off post-response on the app host? (owner: us)

## Recommended Direction (with rationale)

- Harden the ops booking create path so auto-assign emits deterministic outcomes (success/failure) and cannot die silently.
- Consider a bounded inline kick-off or a resumable background trigger for ops walk-ins to guarantee at least one attempt while keeping retries async.
