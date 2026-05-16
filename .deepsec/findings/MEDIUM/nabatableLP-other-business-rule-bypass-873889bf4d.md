# [MEDIUM] Session-recovery guest mutations bypass self-service cutoff checks

**File:** [`src/app/api/bookings/[id]/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/bookings/[id]/route.ts#L1081-L1520) (lines 1081, 1143, 1422, 1520)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-business-rule-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The session-recovery PUT path validates the token and calls handleDashboardUpdate for dashboard-shaped payloads, but that helper only blocks pending/cancelled/past-time cases and never applies evaluateGuestModificationLock. The session-recovery DELETE path similarly validates the token, checks pending/past-time, then soft-cancels without the checked-in/starting-soon lock used by the authenticated delete branch. A guest with a valid manage-link token can directly call these APIs to modify or cancel within the 15-minute cutoff or after early check-in, bypassing the server-side self-service policy.

## Recommendation

Apply evaluateGuestModificationLock to every guest/session-recovery mutation before update or cancellation. Keep staff/dashboard mutation handling separate from guest self-service handling.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-24)

**Verdict:** fixed

Session-recovery dashboard updates now call `handleDashboardUpdate` with `enforceGuestSelfServiceLock: true`, and the session-recovery delete branch evaluates `evaluateGuestModificationLock` before `softCancelBooking`. Checked-in, started, and starting-soon bookings are now blocked for every guest/session-recovery mutation path.

Validation: `pnpm exec vitest run tests/server/booking-validation-security.test.ts tests/server/public-bookings-route.test.ts tests/server/ops-bookings-create-route.test.ts tests/server/public-booking-delete-route.test.ts tests/server/public-booking-session-recovery-source.test.ts tests/server/resend-webhook-route.test.ts`
