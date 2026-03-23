---
task: fix-posthog-runtime-errors
timestamp_utc: 2026-03-23T14:33:34Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Fix PostHog Runtime Errors

## Requirements

- Functional:
  - Fix first-party runtime errors still marked active in PostHog.
  - Prioritize high-confidence matches already identified in `tasks/posthog-error-audit-20260323-1116/`.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Keep guest booking flows stable and mobile-first.
  - Avoid introducing new abstractions or behavior changes outside the impacted error paths.
  - Keep secrets and sensitive telemetry out of committed artifacts.

## Existing Patterns & Reuse

- Existing audit task `tasks/posthog-error-audit-20260323-1116/` already narrowed the actionable issues.
- Guest booking wizard state is centralized under `reserve/features/reservations/wizard/**`.
- Query cache mutation patterns already exist in:
  - `hooks/useUpdateBooking.ts`
  - `hooks/useCancelBooking.ts`
  - `hooks/ops/useUpdateRestaurant.ts`
  - `src/hooks/ops/useOpsBookingStatusActions.ts`
- Ops restaurant switching lives in `src/components/features/ops-shell/OpsRestaurantSwitch.tsx`.

## External Resources

- PostHog MCP issue inventory for project `120939` — authoritative source for currently active runtime errors.

## Constraints & Risks

- Production source maps are still unavailable, so precise symbolication is limited.
- The public booking page crash must be fixed via code-path hardening rather than stack-level certainty.
- Some active PostHog issues may be stale, but this task only targets repo-matched first-party failures.

## Open Questions (owner, due)

- Does the public booking page crash come from malformed schedule payloads or another client-side partial state? (assistant, addressed with boundary hardening)

## Recommended Direction (with rationale)

- Fix the high-confidence null/shape assumptions first:
  - guard nullable `restaurantName` reads in the ops switcher
  - guard list-cache writes against malformed/non-list data
  - normalize reservation schedule payloads at the client API boundary
- Add regression tests for the cache-shape and schedule-shape hardening so these failures do not silently return.
