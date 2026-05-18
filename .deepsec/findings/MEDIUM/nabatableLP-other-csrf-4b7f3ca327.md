# [MEDIUM] No CSRF validation on admin CSV import

**File:** [`src/app/api/ops/restaurants/[id]/drinks/import/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/drinks/import/route.ts#L15-L65) (lines 15, 21, 26, 65)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-csrf`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The import POST authenticates the admin via session cookie and then accepts multipart form data that can preview or apply arbitrary drink-menu changes, but it never validates the CSRF token. A forged same-site POST/fetch with attacker-controlled FormData could cause an authenticated owner/manager to import attacker-supplied menu data for a known restaurant id.

## Recommendation

Validate the CSRF token before reading form data or applying imports. Update the raw fetch client in src/services/ops/drinks-menu.ts to include CSRF_HEADER_NAME, or route uploads through a shared helper that attaches the token.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-18)
