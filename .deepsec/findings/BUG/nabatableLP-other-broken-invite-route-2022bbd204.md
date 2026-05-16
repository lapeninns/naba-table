# [BUG] Generated invite links point to an unimplemented route

**File:** [`lib/owner/team/invite-links.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/lib/owner/team/invite-links.ts#L6) (lines 6)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-broken-invite-route`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

buildInviteUrl() generates /invite/{token}, but tracing the repository shows only invitation API routes under src/app/api/team/invitations/[token] and no shipped src/app/\*\*/invite/[token] page or route. The email and team UI use this helper, so invitees appear to receive a broken 404 link rather than an acceptance flow.

## Recommendation

Add the shipped /invite/[token] acceptance page or change buildInviteUrl() to the actual existing invite acceptance route.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-11-09)

## Resolution

**Verdict:** fixed

`buildInviteUrl()` still generates `/invite/{token}`, and that path is now a
shipped App Router page at `src/app/(public)/invite/[token]/page.tsx`. The page
loads pending invite details server-side, renders the invite acceptance client,
and handles revoked/accepted/expired/missing tokens without falling through to a
missing route.

Evidence:

- `tests/guest/invite-page.test.tsx` covers pending invite rendering and expired
  invite handling.
- `tests/components/InviteAcceptanceClient.test.tsx` covers the authenticated
  accept flow and unauthenticated sign-in redirect.
- Playwright loaded `http://127.0.0.1:3000/invite/invalid-token-123`; the route
  returned the expected invalid-token 404 state with title
  `Team invitation · Nab a Table`.
- `tasks/bug-links-config-invites-20260516-1010/artifacts/invite-invalid-token-route.png`
