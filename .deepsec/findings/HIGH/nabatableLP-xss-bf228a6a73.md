# [HIGH] Email template preview can execute saved template content as same-origin script

**File:** [`src/hooks/ops/useOpsEmailTemplatesPageState.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/hooks/ops/useOpsEmailTemplatesPageState.ts#L203-L315) (lines 203, 208, 313, 315)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `xss`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

This hook sends editable template variants to the preview API and saves those same variants for the restaurant. Template fields such as ctaLabel pass validation with strings like `</script><script>parent.fetch('/api/ops/restaurants')</script>`. The preview renderer later places ctaLabel into a JSON-LD script via raw `JSON.stringify` in `server/emails/base.ts`, which does not escape `</script>`, and the preview UI renders `preview.html` in an unsandboxed `srcDoc` iframe. Because `srcDoc` iframes are same-origin when not sandboxed, a stored malicious variant can execute script in the ops origin when another restaurant member opens the email templates page.

## Recommendation

Use a safe JSON serializer for inline scripts that escapes `<` as `\u003c` or `</` as `<\/`, and render the email preview iframe with a restrictive sandbox that does not allow scripts. Consider also rejecting script terminators in template fields as defense in depth.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-04)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.
