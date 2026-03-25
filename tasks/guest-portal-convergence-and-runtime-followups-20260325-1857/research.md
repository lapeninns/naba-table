---
task: guest-portal-convergence-and-runtime-followups
timestamp_utc: 2026-03-25T18:57:00Z
owner: github:@openai
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Guest portal convergence and runtime follow-ups

## Requirements

- Functional:
  - Complete the remaining guest portal convergence features for dashboard, bookings, and profile.
  - Remove remaining guest portal visual drift by moving the portal surfaces onto the canonical guest shell family.
  - Provide deterministic dev-browser validation surfaces for auth-gated `/guest/*` routes using mocked portal fixtures.
  - Fix feasible misc follow-ups: booking-entry console noise and stale guest booking Playwright assumptions.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Reuse existing guest primitives instead of inventing a parallel portal shell.
  - Keep route pages thin and move logic into `src/components` / `src/guest`.
  - Prefer browser validation on the local dev surface as the default verification mode.

## Existing Patterns & Reuse

- The canonical guest shell primitives already exist in `src/components/guest/ui/GuestPrimitives.tsx`, but the portal clients are not yet using them consistently.
- `GuestServicesProvider` already supports injected `auth`, `bookings`, and `profile` ports, which makes mocked dev harnesses feasible without adding adapter glue.
- The guest route layer is already separated into `src/guest/routes/*/page-view.tsx` and `view-model.ts`, so convergence can happen in the primary client components.
- Existing dev-only harness routes under `src/app/(public)/dev/**` provide the accepted pattern for browser-visible validation when local auth/runtime prevents direct validation.

## External Resources

- None. Repo-local mission files and app code are the source of truth.

## Constraints & Risks

- Auth-gated `/guest/*` browser validation is still mock-driven by mission design because no stable real guest session fixture exists locally.
- `validate-live-apphost-guest-route-canonicalization` likely remains environment-bound unless a local/browser-safe multi-host path is discovered during implementation.
- The stale Playwright flow still references `http://localhost:5180`, so test stabilization must be updated carefully to avoid weakening coverage.
- Booking-entry console noise may include both an obvious page-level debug log and a deeper select-state warning in the reservation wizard.

## Open Questions (owner, due)

- Q: Can the live apphost guest-route canonicalization follow-up be closed locally?
  A: UNCONFIRMED. Treat as likely deferred unless a trustworthy local browser path emerges.

## Recommended Direction (with rationale)

- Refactor dashboard, bookings, and profile to share the canonical guest shell primitives already used by the public guest system.
- Add dev-only portal harness routes that render the real portal clients against injected mock guest services so manual browser QA and Playwright can validate portal states truthfully.
- Remove the stray guest portal debug logging immediately and use the browser console to confirm whether any booking-entry warning remains after the portal/test cleanup.
- Refresh the stale Playwright specs to point at the current port-3000 routes and the new dev harnesses instead of old `5180` assumptions.
