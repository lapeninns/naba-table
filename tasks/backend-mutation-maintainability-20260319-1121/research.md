---
task: backend-mutation-maintainability
timestamp_utc: 2026-03-19T11:21:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Backend mutation maintainability

## Requirements

- Functional:
  - Preserve current behavior for ops booking lifecycle mutation routes.
  - Reduce repeated route-boundary code across check-in, check-out, no-show, and undo-no-show handlers.
  - Keep existing response shapes and status codes stable.
- Non-functional (a11y, perf, security, privacy, i18n):
  - No auth or authorization regressions.
  - No extra queries or additional mutation side effects.
  - Make route logic easier to audit and extend safely.

## Existing Patterns & Reuse

- `src/app/api/ops/bookings/[id]/check-in/route.ts`, `check-out/route.ts`, `no-show/route.ts`, and `undo-no-show/route.ts` repeat the same boundary work:
  - resolve route param booking id
  - parse optional JSON payloads
  - resolve auth user
  - load booking row
  - enforce restaurant membership
  - load restaurant lifecycle timing data
  - persist transitions via `apply_booking_state_transition`
- `src/app/api/ops/bookings/[id]/status/route.ts` contains a second copy of the transition persistence logic and is a good secondary reuse target.
- Core lifecycle transition rules already live in `server/ops/booking-lifecycle/actions.ts`, so the refactor can stay focused on route glue rather than business rules.

## Constraints & Risks

- The route handlers are system boundaries, so error payloads and status codes need to remain stable.
- `check-out` and `no-show` include side effects after persistence, so any helper must stop short of hiding those route-specific steps.
- `status/route.ts` is deprecated but still used by the UI, so shared persistence behavior should remain compatible there as well.

## Open Questions (owner, due)

- Q: Should this pass also consolidate the deprecated status route's auth and membership flow?
  A: No. Keep this pass focused on the lifecycle mutation routes plus shared transition persistence where it is identical.

## Recommended Direction (with rationale)

- Add a local shared helper module under `src/app/api/ops/bookings/[id]/` for:
  - route param id resolution
  - optional JSON body parsing
  - lifecycle mutation context loading (auth, booking, membership, restaurant timing)
  - transition persistence through the shared RPC contract
- Update the four lifecycle mutation routes to use that shared helper and, where safe, reuse the same persistence helper in the deprecated status route.
