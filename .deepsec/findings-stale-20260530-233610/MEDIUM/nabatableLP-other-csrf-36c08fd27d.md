# [MEDIUM] Cookie-authenticated menu item creation lacks CSRF validation

**File:** [`src/app/api/ops/restaurants/[id]/menu/items/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/menu/items/route.ts#L50-L88) (lines 50, 56, 61, 88)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `other-csrf`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The POST handler authenticates via cookie-backed Supabase auth, parses request.json(), and writes menu item data with upsertMenuItem, but it never validates the CSRF token. The frontend fetchJson helper attaches x-csrf-token, but the server does not enforce it. A same-site cross-origin page, or HTML injection on the public root host, can submit a form POST with a text/plain JSON body and cause a logged-in owner/manager browser to create menu items.

## Recommendation

Require validateCsrfToken(request) for this POST and reject missing/invalid tokens before processing the JSON body.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-18)
