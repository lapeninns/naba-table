# [MEDIUM] Drink import mutation lacks CSRF enforcement

**File:** [`src/services/ops/drinks-menu.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/services/ops/drinks-menu.ts#L127-L130) (lines 127, 128, 129, 130)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-csrf`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

postImport sends a credentialed multipart POST with raw fetch instead of the CSRF-aware fetchJson helper. The called route at src/app/api/ops/restaurants/[id]/drinks/import/route.ts verifies admin membership, then reads formData and applies imports for mode=apply, but never validates the double-submit CSRF token. This leaves an admin-only drink import mutation exposed to targeted forged requests.

## Recommendation

Attach the CSRF header for multipart imports and reject POST in the import route unless validateCsrfToken(request) succeeds before formData is read.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-18)
