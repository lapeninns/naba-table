# [HIGH] Legacy booking update path allows unauthenticated reservation mutation

**File:** [`src/app/api/bookings/[id]/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/bookings/[id]/route.ts#L1169-L1395) (lines 1169, 1180, 1211, 1216, 1228, 1238, 1320, 1341, 1395)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `missing-auth`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The full-update fallback in PUT does not require a session or signed session-recovery token. It calls auth.getUser(), but only logs authError and never checks that a user exists. The only gate is matching the submitted email and phone against the existing booking, after which the service-role client updates the booking. The same path also accepts data.restaurantId and writes it into the update payload, so a caller who knows a booking UUID plus contact details can change reservation details and potentially move the booking to another active restaurant tenant.

## Recommendation

Remove the unauthenticated legacy update path, or require a valid session-recovery access token/session before any mutation. Do not accept restaurantId changes from guest self-service updates; require it to match existingBooking.restaurant_id. Return a sanitized DTO instead of the full updated row.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-24)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.
