# [MEDIUM] Team invite email creation has no server-side rate limit

**File:** [`src/app/api/ops/team/invitations/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/src/app/api/ops/team/invitations/route.ts#L123-L175) (lines 123, 175)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `expensive-api-abuse`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

POST authenticates the user, enforces admin membership, checks CSRF, and validates invite roles, but it does not apply any rate limit before createRestaurantInvite sends a team invitation email. Nearby paid or sensitive routes use requireApiRateLimit/provider budgets, but this endpoint can send arbitrary invitations to arbitrary email addresses for a restaurant. A compromised or malicious manager/owner account could abuse the email provider, harm sender reputation, or generate cost by creating invites at high volume.

## Recommendation

Apply requireApiRateLimit before creating the invite, scoped by restaurantId, authenticated userId, and client IP. Consider a tighter per-recipient/per-restaurant pending-invite quota as a second layer.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-19)
