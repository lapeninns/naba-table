---
task: fix-replay-ops-card-hydration
timestamp_utc: 2026-02-04T19:07:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Fix Replay Guard + Booking Card Hydration

## Requirements

- Functional:
- Disable Sentry Replay on `/app` routes even after client-side navigation.
- Avoid SSR hydration mismatch for ops booking card responsive layout.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Preserve existing Replay sampling behavior outside ops routes.
  - Keep booking card behavior and a11y intact.

## Existing Patterns & Reuse

- Client instrumentation hooks in `src/instrumentation-client.ts`.
- Ops booking card uses `Collapsible` + `OpsBookingCardDetails` (`src/components/features/dashboard/cards/*`).
- `useIsMobile` hook exists in `hooks/use-mobile.ts` (SSR-safe pattern).

## External Resources

- Sentry Replay docs (manual start/stop, integration add): docs.sentry.dev/product/session-replay/configuration/ (2026).

## Constraints & Risks

- Follow root + `src/components/AGENTS.md` policies; UI changes require Chrome DevTools MCP QA.
- Avoid extra analytics features or broader refactors.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Guard Replay on route transitions by stopping Replay when navigating into `/app` and avoid re-init.
- Keep booking card DOM stable across SSR/client by avoiding conditional wrapper swaps.
