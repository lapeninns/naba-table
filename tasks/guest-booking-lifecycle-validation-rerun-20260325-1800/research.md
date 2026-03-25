---
task: guest-booking-lifecycle-validation-rerun
timestamp_utc: 2026-03-25T18:00:52Z
owner: github:@openai
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Guest booking lifecycle validation rerun

## Requirements

- Functional:
  - Continue the paused `guest-booking-lifecycle` mission from the dedicated worktree.
  - Produce fresh validation evidence for stale assertions `VAL-BOOKING-002`, `VAL-BOOKING-004`, `VAL-BOOKING-005`, `VAL-BOOKING-008`, `VAL-BOOKING-009`, `VAL-BOOKING-010`, and `VAL-BOOKING-011`.
  - Fix any live-runtime gaps uncovered by the rerun before updating mission validation artifacts.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Preserve guest-system route ownership and reuse existing guest primitives.
  - Keep auth/recovery invariants centralized.
  - Use Chrome DevTools MCP for manual browser verification.

## Existing Patterns & Reuse

- Public booking recovery and comparison harnesses already exist under `src/app/(public)/dev/`.
- Public booking detail and guest booking detail already share `ReservationDetailClient`.
- Tokenized/public recovery authorization already flows through `/bookings/recover` and `/api/bookings/[id]`.
- Receipt pages already prefetch tokenized booking data on the server, but the client hook path also needs the same entitlement context after hydration.
- Dev harness routes already exist for booking recovery and booking detail; the same pattern is acceptable when local runtime data is missing but UI validation is still required.

## External Resources

- None needed beyond repo-local mission contract and existing app patterns.

## Constraints & Risks

- The work must stay inside `/Users/amankumarshrestha/LapenInns Project/nabatableLP-guest-design-system-20260325-0745`.
- No database changes or new services.
- Validation is against the live dev server on `http://localhost:3000`.
- Fresh browser rerun exposed runtime gaps instead of a pure artifact problem:
  - `Book Again` currently routes fixture traffic to a not-found restaurant booking page.
  - There is still no live/dev harness for booking-detail loading and error states.
- Read-only remote data inspection after the route fix showed bookings `33333333-3333-4333-8333-333333333333`, `44444444-4444-4444-8444-444444444444`, and `55555555-5555-4555-8555-555555555555` are absent from the connected dataset, so the historical `?token=abc123` receipt URL cannot succeed locally without a dev harness or fresh seed data.

## Open Questions (owner, due)

- Q: Should rebook always prefer a restaurant-specific booking route or fall back to discovery when the restaurant slug is not publicly resolvable?
  A: Use the restaurant-specific route when available, otherwise fall back to `/restaurants` so the guest never lands on a dead end.

## Recommended Direction (with rationale)

- Extend the shared reservation hook and receipt client so tokenized receipt access remains entitled after hydration.
- Accept that the old `abc123` validation URL is a missing-data problem in this environment and cover receipt lifecycle browser validation with a dev-only harness that reuses the canonical receipt UI.
- Add a small dev-only booking-detail states harness that reuses the canonical loading/error UI for browser validation.
- Centralize rebook destination fallback so fixture and real bookings avoid not-found dead ends.
- Regenerate user-testing evidence and mission validation state only after the live rerun proves the corrected behavior.
