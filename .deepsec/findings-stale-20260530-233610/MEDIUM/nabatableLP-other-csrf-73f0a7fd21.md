# [MEDIUM] Drink CSV import apply path lacks CSRF protection at the API boundary

**File:** [`src/components/features/menu/DrinkImportDialog.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/features/menu/DrinkImportDialog.tsx#L96-L102) (lines 96, 102)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `other-csrf`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The dialog triggers preview/apply mutations for authenticated, cookie-backed ops import requests. Tracing `useOpsDrinkMenuImportApply` shows `src/services/ops/drinks-menu.ts` posts `FormData` with `credentials: 'include'` and no CSRF header, and `src/app/api/ops/restaurants/[id]/drinks/import/route.ts` performs the admin check but never calls `validateCsrfToken` before accepting `mode=apply` and applying the import. A same-site attacker, or a deployment where auth cookies are sent cross-site, could submit a forged multipart POST that overwrites drink menu data for an admin's active session.

## Recommendation

Require `validateCsrfToken(request)` in the drink import route before reading form data, and send `CSRF_HEADER_NAME` from `postImport` using `getBrowserCsrfToken()`.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-01)
