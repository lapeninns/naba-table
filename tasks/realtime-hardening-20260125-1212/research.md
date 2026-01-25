---
task: realtime-hardening
timestamp_utc: 2026-01-25T12:12:46Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: [NEXT_PUBLIC_FEATURE_REALTIME_FLOORPLAN]
related_tickets: []
---

# Research: Realtime Hardening (Ops)

## Requirements

- Functional:
  - Ops bookings list updates in realtime when realtime flag is enabled.
  - Ops summary, changes feed, heatmap, and booking detail stay consistent with realtime updates.
  - Realtime is enabled by default unless explicitly disabled via env.
  - Polling acts as fallback when realtime is disabled or unhealthy.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Avoid excessive background polling or cache churn.
  - Keep invalidations scoped (restaurant/date) to reduce network load.
  - Maintain existing UX behavior where possible.

## Existing Patterns & Reuse

- Realtime client singleton: `src/lib/supabase/realtime-client.ts`.
- Realtime health / status: `src/hooks/ops/useRealtimeConnection.ts`.
- Summary realtime: `src/hooks/ops/useOpsTodaySummary.ts`.
- Changes feed realtime: `src/hooks/ops/useOpsBookingChanges.ts`.
- Heatmap realtime: `src/hooks/ops/useOpsBookingHeatmap.ts`.
- Booking table assignments realtime: `src/hooks/ops/useBookingRealtime.ts`.

## External Resources

- None (internal patterns only).

## Constraints & Risks

- Supabase remote-only (no local DB changes).
- UI changes require DevTools MCP QA.
- Risk of stale list if realtime flag disables polling without list subscription.
- Risk of over-invalidating caches leading to performance regressions.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Add bookings table realtime invalidation for the ops list to close the stale list gap.
- Gate polling by realtime health and visibility; keep a safe fallback interval only when unhealthy.
- Reuse existing debounce and query key patterns to keep changes minimal.
