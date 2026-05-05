# [MEDIUM] Drink import apply flow relies on cookie auth without server-side CSRF enforcement

**File:** [`src/components/features/menu/DrinkImportDialog.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/features/menu/DrinkImportDialog.tsx#L102) (lines 102)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-csrf`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The dialog's apply action calls applyMutation.mutateAsync(payload), which posts a multipart request to /api/ops/restaurants/:id/drinks/import with mode=apply. Tracing the handler shows it checks ensureRestaurantAdminAccess but never calls validateCsrfToken before reading formData and applying the import. The service helper also uses raw fetch with credentials: 'include' and does not attach the CSRF header used by fetchJson. In any browser context where the victim's ops cookies are sent, an attacker could induce an authenticated owner/manager to submit a forged import and overwrite drink menu data.

## Recommendation

Require validateCsrfToken(request) in the drinks import POST handler before parsing form data, return 419 on failure, and update postImport to send CSRF_HEADER_NAME from getBrowserCsrfToken().

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-01)
