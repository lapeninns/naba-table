# [HIGH] Template-controlled text can break out of the email preview JSON-LD script

**File:** [`lib/restaurants/email-templates.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/lib/restaurants/email-templates.ts#L170-L460) (lines 170, 179, 454, 458, 460)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `xss`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

Restaurant email template fields are normalized and later interpolated as plain strings without script-context encoding. Normal HTML rendering escapes these values, but the interpolated CTA label and venue fields are also passed into server/emails/base.ts, where renderAnnotationScript embeds JSON.stringify(schema) directly inside a <script type="application/ld+json"> tag. A payload such as </script><script>...</script> in a saved template field like ctaLabel can close the JSON-LD script. The preview response returns the resulting HTML, and EmailTemplatesPreviewPane renders it through an unsandboxed iframe srcDoc, so the injected script can execute in the ops browser context. Read access can render saved templates, while write access can persist the payload for other restaurant members.

## Recommendation

Escape JSON before embedding it in any script tag, for example JSON.stringify(schema).replace(/</g, '\\u003c'), or use a shared safeJsonStringify helper. Also sandbox the preview iframe unless scripts are explicitly required.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-04)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.
