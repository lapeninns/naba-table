---
task: fix-review-findings
timestamp_utc: 2026-02-04T19:03:46Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Fix Review Findings (Ops Dashboard + Instrumentation)

## Requirements

- Functional:
- Preserve selected date state when URL updates do not include a `date` param.
- Ensure Sentry Replay is disabled on ops routes, including client-side transitions.
- Avoid hydration mismatch for ops booking cards on mobile.
- Non-functional (a11y, perf, security, privacy, i18n):
- Keep SSR markup stable between server and client.
- Avoid capturing ops UI in replay on route transitions.

## Existing Patterns & Reuse

- `src/components/features/dashboard/useOpsDashboardState.ts` syncs URL params to state.
- `src/instrumentation-client.ts` initializes Sentry and exports `onRouterTransitionStart`.
- `src/components/features/dashboard/cards/OpsBookingCard.tsx` uses a local `useMediaQuery` hook.

## External Resources

- Sentry Replay APIs (manual start/stop) for route-based gating.

## Constraints & Risks

- Ops UI should not be captured by replay on route transitions.
- Maintain consistent SSR markup to avoid hydration warnings.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Guard URL param sync to avoid clearing `selectedDate` when no date param is present.
- Use `Sentry.getReplay()` to stop/start replay based on target route in `onRouterTransitionStart`.
- Initialize media-query state on the client after mount to keep SSR markup stable.
