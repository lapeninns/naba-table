# [HIGH] Stored restaurant fields can break out of the email preview script tag

**File:** [`src/services/ops/restaurants.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/services/ops/restaurants.ts#L935-L1397) (lines 935, 1250, 1397)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `xss`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The service can update restaurant profile fields and later fetches email preview HTML as `preview.html`. Tracing that preview path shows the server embeds venue data in an inline `application/ld+json` script with raw `JSON.stringify(schema)`, and the client renders the returned HTML in an unsandboxed `iframe srcDoc`. Because `JSON.stringify` does not escape `</script>`, a manager or owner can store a restaurant name/address containing a script-breakout payload and execute JavaScript in the ops origin when another ops user opens the email template preview.

## Recommendation

Use a safe JSON serializer for inline scripts that escapes `<`, `>`, `&`, and line separators, and sandbox the email preview iframe without script execution unless scripts are strictly required.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-29)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.
