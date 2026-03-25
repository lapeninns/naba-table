---
task: guest-portal-convergence-and-runtime-followups
timestamp_utc: 2026-03-25T18:57:00Z
owner: github:@openai
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Inventory remaining guest mission features against the current codebase and mission tracker.
- [x] Inspect current portal/browser constraints with dev browser and local routes.

## Portal convergence

- [x] Unify dashboard shell and state presentation with canonical guest primitives.
- [x] Unify bookings shell and state presentation with canonical guest primitives.
- [x] Unify profile shell and form feedback with canonical guest primitives.

## Dev validation surfaces

- [x] Add dev-only guest portal harness coverage for dashboard, bookings, and profile.
- [x] Ensure harnesses use real portal clients with injected mock services/session data.

## Runtime/test follow-ups

- [x] Remove obvious guest/booking console noise that is safe to clean up now.
- [x] Refresh stale guest booking Playwright assumptions to current port-3000 flows.
- [ ] Reassess whether local dev can truthfully close apphost guest-route canonicalization.

## Verification

- [x] Run focused Vitest coverage for guest portal helpers/view models.
- [x] Run relevant Playwright specs on current supported flows.
- [x] Use Chrome DevTools on dev harnesses and booking-entry routes by default.
- [x] Run `pnpm typecheck`.
- [x] Run `pnpm lint`.

## Notes

- Assumptions:
  - Dev-only portal harnesses are the truthful validation mechanism for auth-gated portal routes in local development.
- Deviations:
  - `validate-live-apphost-guest-route-canonicalization` may remain deferred if the known local multi-host limitation still blocks trustworthy browser validation.
  - Chrome DevTools MCP was used for the initial harness and booking-route verification, but the DevTools transport closed during the final booking-entry follow-up; the post-fix booking-entry rerun was captured with a real Playwright browser artifact instead.

## Batched Questions

- None.
