# [BUG] Invite token redirect targets a missing invite route

**File:** [`next.config.js`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/next.config.js#L121-L122) (lines 121, 122)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-stale-redirect`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The `/invite/:token` redirect points at `/account/invite/:token`, but no matching invite route exists under `src/app`. This breaks preserved invite-token flows and can leave invite links permanently redirecting to a 404.

## Recommendation

Either implement the `/account/invite/[token]` route or update the redirect destination to the current invite-acceptance route.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-21)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-15)

**Verdict:** fixed

`next.config.js` no longer redirects `/invite/:token` to missing
`/account/invite/:token`. Invite links now resolve directly to the shipped
`/invite/[token]` App Router page.

Evidence:

- `tests/config/link-config.test.ts` verifies there is no `/invite/:token`
  redirect.
- `tests/guest/invite-page.test.tsx` verifies `/invite/[token]` page wiring.
- Playwright loaded `http://127.0.0.1:3000/invite/invalid-token-123`; the route
  returned the expected invalid-token 404 state with title
  `Team invitation · Nab a Table`.
