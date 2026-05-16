# [HIGH] Stored email-template copy can execute script in the ops preview iframe

**File:** [`src/hooks/ops/useOpsEmailTemplatesPageState.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/hooks/ops/useOpsEmailTemplatesPageState.ts#L204-L315) (lines 204, 208, 313, 315)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `xss`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

This hook sends the current email template variants to the preview endpoint and also persists edited variants. The variant fields are admin-controlled and only length/token validated by the API schema, not HTML-script sanitized. The traced renderer escapes normal email body fields, but server/emails/base.ts emits the email annotation as `<script type="application/ld+json">${JSON.stringify(schema)}</script>` without escaping `<` or `</script>`. A malicious template value such as a CTA label containing `</script><script>...</script>` therefore breaks out of the JSON-LD script. The preview HTML is then returned to the client and rendered via an unsandboxed `srcDoc` iframe in EmailTemplatesPreviewPane, so saved malicious template copy can execute JavaScript when another restaurant member opens the template preview.

## Recommendation

Escape JSON embedded in HTML script contexts in the email renderer, for example with a safeJsonStringify helper that replaces `<` with `\u003c` or at least escapes `</` as `<\/`. Also sandbox the preview iframe without `allow-scripts` unless scripts are explicitly required.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-04)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.
