# Research synthesis: booking cutoff workarounds

## Executive summary

No new kitchen-open or kitchen-close database columns are needed. The existing `restaurant_operating_hours.opens_at` and `closes_at` are already treated as the kitchen operating boundary.

There are two defensible fixes:

1. **Minimal compatibility fix:** make guest availability party-aware and filter with `start + resolvedDuration <= close`. This exactly matches current Create validation, but leaves the last-seating setting dead.
2. **Complete contract fix:** enforce both independent rules using `start + max(lastSeatingBuffer, resolvedDuration) <= close`. This removes Plan/Create disagreement and makes the existing buffer setting real.

The complete contract fix best matches the stated problem.

## Recommended architecture

- Keep `getRestaurantSchedule` as the raw date/configuration schedule for existing internal consumers.
- Add a party-aware guest projection using the same duration resolver as Create.
- Add party size to the public schedule/availability request and cache key.
- Return per-slot effective duration or eligibility metadata.
- Re-evaluate the same shared rule during public and ops Create for stale/manual clients.
- Eventually harden the atomic capacity RPC, which currently validates start but not end.

## Rule

```text
configured service window:
  serviceStart <= start < serviceEnd

guest eligibility:
  start + resolvedDuration <= operatingClose
  start + lastSeatingBuffer <= operatingClose

equivalent:
  start <= operatingClose - max(resolvedDuration, lastSeatingBuffer)
```

An end exactly equal to close is accepted. Service-period end remains a start boundary, not a dining-finish boundary. Fixed slots remain candidate starts and do not bypass the rule.

## Example

Close 22:00, buffer 30:

- 60-minute turn: latest start 21:00.
- 90-minute turn: latest start 20:30.
- 120-minute turn: latest start 20:00.

Close 22:00, buffer 90:

- 60-minute turn: latest start 20:30 because buffer is stricter.
- 90-minute turn: latest start 20:30.
- 120-minute turn: latest start 20:00 because duration is stricter.

## Rejected workarounds

- Buffer-only: can still show a slot whose duration overruns close.
- Automatic shortening: downstream capacity and confirmation recompute the normal duration.
- Allow-over-close: conflicts with current non-overridable validation and SQL/storage assumptions.
- Fixed-slot implicit override: slot provenance and exception intent are not represented.
- Longest-duration filtering: safe emergency fallback but hides valid small-party inventory.

## Rollout caveats

- After-midnight and DST slots need absolute-instant handling or temporary fail-closed suppression.
- Decide whether authorized ops staff may override a buffer-only violation when the dining duration still finishes by close.
- Keep cleanup/post-table buffers separate unless the product explicitly requires the room to be clear by closing.

## Convergence

Two research waves covered schema/settings, slot generation, create validation, database capacity, history/tests, architecture options, and temporal/ops edge cases. Technical alternatives converged; remaining questions are explicit product policy choices rather than undiscovered code behavior.
