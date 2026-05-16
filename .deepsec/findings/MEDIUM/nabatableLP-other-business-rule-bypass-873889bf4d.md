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

## Revalidation

**Verdict:** true-positive

The shared evaluateGuestModificationLock function enforces the checked-in, already-started, and under-15-minute guest self-service lock. The full legacy update path now calls that lock, and the authenticated DELETE branch also calls it before cancellation. The session-recovery dashboard-shaped PUT path, however, validates the token and contact and then calls handleDashboardUpdate directly. handleDashboardUpdate only checks pending, cancelled, operating hours, and past-time cases; it never calls evaluateGuestModificationLock. The session-recovery DELETE path likewise validates the token and contact, checks pending and past-time, then soft-cancels without the cutoff or checked-in lock used by the authenticated delete branch. A guest with a valid session-recovery token can therefore send the dashboard update body or DELETE while the booking starts in under 15 minutes, and the past-time check will still pass because the start is in the future. The token checks limit this to bookings matching the token contact and restaurant, so this is a real self-service policy bypass rather than a cross-tenant takeover.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
