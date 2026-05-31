# [MEDIUM] Invite acceptance mutation does not enforce CSRF

**File:** [`src/app/api/team/invitations/[token]/accept/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/src/app/api/team/invitations/[token]/accept/route.ts#L22-L93) (lines 22, 28, 30, 35, 44, 87, 93)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-missing-csrf`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The POST handler is a cookie-authenticated state-changing endpoint: it resolves the Supabase session from cookies and then accepts the invite through acceptInviteForAuthenticatedUser, which upserts restaurant membership. Unlike nearby team/profile mutations, this route never calls withCsrfProtectedMutation or validateCsrfProtectedMutation. The client sends an x-csrf-token header, but the server ignores it. Because invalid or missing JSON is treated as an empty object and name is optional, a forged simple POST can reach the mutation if the browser sends the victim's session cookies and the attacker has or can plant a valid invite token for that victim email.

## Recommendation

Wrap POST with withCsrfProtectedMutation before parsing the body, add a regression test that missing or mismatched CSRF is rejected before side effects, and consider requiring application/json for this endpoint.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-27)
