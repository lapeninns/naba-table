---
task: dashboard-perceived-latency
timestamp_utc: 2026-02-05T15:23:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Dashboard Perceived Latency

## Objective

Make `/app/dashboard` transitions feel deliberate by preventing loader flashes and smoothing refresh indicators without slowing real work.

## Success Criteria

- [ ] No skeleton/content flash on fast loads or refetches.
- [ ] Refresh indicators appear only when fetches exceed a short delay and remain visible briefly.
- [ ] Reduced-motion users see minimal animation.
- [ ] No changes to data fetching behavior or cache keys.

## Architecture & Components

- Add `src/hooks/use-minimum-delay.ts` with a `useMinimumDelay(isLoading, { delayMs, minDurationMs })` hook.
- Apply to:
  - `OpsDashboardClient` to gate summary skeleton rendering.
  - `OpsDashboardHeader` to delay “Updating…” UI and opacity changes.
  - `BookingsListControls` to delay the refresh pill.
  - `HeatmapCalendar` to delay `aria-busy`/opacity loading state.
  - `BookingDetailsDialogWrapper` to delay dialog skeleton when no initial data.
  - `OpsBookingCard` to delay lifecycle action overlay for seat/finish/no-show.
- Add subtle content fade-in using existing animation utilities (motion-safe only).

## Data Flow & API Contracts

- No API changes. React Query behavior remains unchanged; SWR behavior already provided by `placeholderData: keepPreviousData`.

## UI/UX States

- Initial load: route-level `DashboardSkeleton` + summary skeleton gated by `useMinimumDelay`.
- Refetch: keep content visible, show delayed inline “Updating…” indicators.
- Dialog load: show delayed skeleton only when no initial data.
- Lifecycle actions: freeze list ordering while seat/finish/no-show is pending; release on completion.
  - Booking card overlay uses 200ms delay / 400ms minimum duration.

## Edge Cases

- Instant cached loads should not show skeletons.
- Rapid filter changes should not cause “blink” of refresh indicators.
- Reduced-motion should not animate noticeably.
- Pending lifecycle action should not reshuffle list or move cards between filters until completion.

## Testing Strategy

- Typecheck: `pnpm typecheck`.
- Build: `pnpm build`.
- Manual QA: Chrome DevTools MCP on `/app/dashboard` (console/network, load timing, reduced motion).

## Rollout

- No feature flag. Ship as UI polish.
- Monitor for regressions via console logs and visual smoke checks.

## DB Change Plan (if applicable)

- N/A.
