# [HIGH] Email template fields can break out of the preview iframe via JSON-LD script injection

**File:** [`src/app/api/ops/restaurants/schema.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/schema.ts#L253-L361) (lines 253, 277, 286, 295, 361)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `xss`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The email template schemas accept author-controlled strings such as subject, headline, intro, and ctaLabel with only length and token validation. A payload like </script><script>alert(1)</script> passes validation. These values flow into the booking email preview HTML, where JSON.stringify output is embedded inside a JSON-LD <script> tag without escaping '<', and the ops UI renders that HTML in an unsandboxed srcDoc iframe. A saved malicious variant, or a crafted draft preview, can execute JavaScript in the ops origin when a member views the preview.

## Recommendation

Use safe JSON serialization for script contexts, for example escaping '<' as '\u003c', before embedding JSON-LD. Also sandbox the email preview iframe without same-origin script privileges unless they are strictly required, and consider rejecting script-breaking sequences in template fields as defense in depth.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-29)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.
