---
task: fix-dashboard-hydration-mismatch
timestamp_utc: 2026-03-23T16:49:00Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Ops dashboard hydration mismatch

## Objective

We will make the ops dashboard render the same time-sensitive text on the server and during the first client hydration so that `/dashboard` loads without React hydration failures.

## Success Criteria

- [ ] `/dashboard` no longer throws React hydration error `#418`.
- [ ] Relative sync labels and booking urgency badges remain stable on first paint.
- [ ] Existing live updates still resume after hydration.

## Architecture & Components

- `src/app/app/(app)/dashboard/page.tsx`: provide a server-side `initialNowIso` snapshot.
- `src/components/features/dashboard/OpsDashboardClient.tsx`: thread the snapshot through the dashboard tree.
- `src/components/features/dashboard/ConnectionStatusBeacon.tsx`: seed relative-time state from the snapshot, then tick on the client.
- `src/components/features/dashboard/list/useBookingsListState.ts`: seed booking temporal calculations from the same snapshot.

## Data Flow & API Contracts

- No API or schema changes.
- New internal prop contract:
  - `initialNowIso: string`

## UI/UX States

- Loading / Empty / Error / Success states remain unchanged.
- Only the initial time reference becomes deterministic.

## Edge Cases

- Missing or invalid snapshot should safely fall back to current client time after hydration.
- Relative-time labels must still update after the initial paint.
- Booking urgency text must remain correct once the interval refreshes.

## Testing Strategy

- Focused lint/type verification for touched files.
- Manual Chrome DevTools QA on the dashboard or a dev harness route.
- Confirm no hydration warnings/errors in console.

## Rollout

- No feature flag required.
- Deploy as a standard bug fix with post-deploy console monitoring on `/dashboard`.

## DB Change Plan (if applicable)

- Not applicable.
