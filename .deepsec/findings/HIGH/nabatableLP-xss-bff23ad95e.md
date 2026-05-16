# [HIGH] Unsandboxed email preview can execute template-controlled script

**File:** [`src/components/features/email-templates/EmailTemplatesPreviewPane.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/features/email-templates/EmailTemplatesPreviewPane.tsx#L179-L181) (lines 179, 181)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `xss`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The preview pane renders server-provided email HTML directly with iframe srcDoc at line 181, and it does not pass a sandbox attribute. The shared Iframe component is only a thin iframe wrapper, so srcDoc content runs as a same-origin document with script execution allowed. The traced renderer escapes visible template text, but server/emails/base.ts emits JSON-LD as `<script type="application/ld+json">${JSON.stringify(schema)}</script>` without escaping `<`. Template-controlled fields such as ctaLabel are included in that schema, and the API schema allows arbitrary text up to length limits. A malicious saved value like `</script><script>parent.fetch('/api/ops/...')</script>` breaks out of the JSON-LD script and executes when another staff member opens the email template preview.

## Recommendation

Make the preview iframe inert by default, for example `sandbox=""` with no `allow-scripts` or `allow-same-origin`, and also fix the email renderer to safely serialize JSON-LD by escaping `<` such as `JSON.stringify(schema).replace(/</g, '\\u003c')`.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-04)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.
