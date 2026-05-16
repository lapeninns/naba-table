# [MEDIUM] Drink import POST omits CSRF protection

**File:** [`src/services/ops/drinks-menu.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/services/ops/drinks-menu.ts#L73-L127) (lines 73, 77, 127)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-csrf`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

previewImport() and applyImport() call postImport(), which sends a credentialed multipart POST with raw fetch and no x-csrf-token header. The matching /api/ops/restaurants/[id]/drinks/import route authenticates the admin session and can apply uploaded drink-menu data, but does not validate the CSRF token before reading formData or mutating via applyDrinkImport().

## Recommendation

Attach the browser CSRF token to multipart import requests and require validateCsrfToken() in the drinks import route before parsing formData or applying imports.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-18)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.
