---
task: booking-flow-audit
timestamp_utc: 2026-04-01T16:32:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Booking Flow Audit Follow-up Fixes

## Objective

We will close the confirmed booking-flow follow-up issues so that waitlist dedupe remains stable across code versions, guest self-serve ownership checks remain tolerant of stored normalization drift, and the touched UI/framework files reflect real behavior.

## Success Criteria

- [ ] Waitlist lookup matches both legacy local-format and canonical E.164 UK phone values during rollout.
- [ ] Touching an existing waitlist row rewrites its stored phone to canonical format.
- [ ] Self-serve email ownership checks compare normalized stored and incoming values.
- [ ] `next-env.d.ts` no longer imports `.next/dev` artifacts.
- [ ] Focused regression tests and typecheck pass.

## Architecture & Components

- `server/bookings.ts`: own backward-compatible waitlist matching and forward canonicalization.
- `src/app/api/bookings/[id]/route.ts`: normalize stored emails at comparison boundaries.
- `src/components/features/dashboard/cards/OpsBookingCard.tsx`: remove dead disabled-state branch.
- `next-env.d.ts`: restore safe generated baseline.
- `tests/server/bookings/waitingList.test.ts`: prove cross-version waitlist compatibility behavior.

## Data Flow & API Contracts

Endpoint: internal waitlist persistence path in `server/bookings.ts`
Request: existing booking/waitlist inputs
Response: unchanged external shape
Errors: unchanged

Endpoint: guest self-serve booking read/update/delete in `src/app/api/bookings/[id]/route.ts`
Request: existing authenticated guest input
Response: unchanged external shape
Errors: unchanged ownership semantics, with fewer false negatives for legacy stored email casing/spacing

## UI/UX States

- No user-facing visual redesign in this pass.
- Ops booking card still dims on loading; dead visual-disabled branch is removed because it is not reachable from current callers.

## Edge Cases

- Legacy waitlist phone stored as `079...` while new request arrives as `+4479...`.
- Incoming waitlist phone arrives as formatted local digits with spaces or punctuation.
- Stored booking email contains legacy casing while guest submits lowercased normalized input.

## Testing Strategy

- Unit/regression:
  - waitlist compatibility test for `.in(...)` dual-read behavior and canonical insert/update shape
  - existing phone normalization regression tests
  - timeout recovery normalization tests
  - contact validation tests
- Validation:
  - `pnpm typecheck`

## Rollout

- No feature flag needed.
- Safe rollout because waitlist matching becomes more permissive during transition and rewrites touched rows to canonical storage.
- Monitor waitlist duplicate reports and guest self-serve authorization errors after deploy.

## DB Change Plan (if applicable)

- No schema migration in this pass.
- Data compatibility handled in application logic.
