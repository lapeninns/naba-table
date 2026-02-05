---
task: ops-realtime-hardening
timestamp_utc: 2026-02-05T08:41:15Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Ops Realtime Hardening

## Requirements

- Functional:
  - Ensure ops dashboard summary data is refreshed even if realtime stays subscribed but stops delivering events.
  - Smooth bursty realtime invalidations to reduce refetch thrash.
  - Surface data freshness in the ops UI.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Keep refresh intervals conservative to minimize traffic.
  - No new dependencies; keep hooks focused and composable.
  - UI changes must preserve accessibility and responsive behavior.

## Existing Patterns & Reuse

- Summary query + realtime subscription: `src/hooks/ops/useOpsTodaySummary.ts`.
- Realtime invalidation debounce pattern: `src/hooks/ops/useBookingRealtime.ts`.
- Connection status UI: `src/components/features/dashboard/ConnectionStatusBeacon.tsx`.

## External Resources

- None.

## Constraints & Risks

- Avoid adding new feature flags or backend changes.
- Avoid stale UI indicators when no data has loaded yet.
- Ensure safety poll does not run in background tabs.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Add safety poll every 3 minutes when realtime is healthy and tab is visible, to mitigate silent staleness.
- Debounce summary invalidations to coalesce bursts.
- Expose data freshness in the existing connection beacon for a lightweight UI signal.
