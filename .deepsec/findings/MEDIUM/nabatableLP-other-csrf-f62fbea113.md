# [MEDIUM] Menu import POST omits CSRF protection

**File:** [`src/services/ops/menu.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/services/ops/menu.ts#L73-L127) (lines 73, 77, 127)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-csrf`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

previewImport() and applyImport() call postImport(), which sends a credentialed multipart POST with raw fetch and no x-csrf-token header. The matching /api/ops/restaurants/[id]/menu/import route authenticates the admin session and can apply uploaded menu data, but does not validate the CSRF token before reading formData or mutating via applyMenuImport().

## Recommendation

Attach the browser CSRF token to multipart import requests and require validateCsrfToken() in the menu import route before parsing formData or applying imports.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-18)
