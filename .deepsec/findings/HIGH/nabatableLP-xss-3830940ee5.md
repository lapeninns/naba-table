# [HIGH] Stored XSS through email template preview script break-out

**File:** [`lib/restaurants/email-templates.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/lib/restaurants/email-templates.ts#L170-L461) (lines 170, 179, 454, 461)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `xss`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

Custom email template fields are normalized with only trimming/fallbacks and later interpolated without escaping. In the traced consumer, these strings become booking email fields, including ctaLabel. server/emails/base.ts embeds annotation data with raw JSON.stringify inside a <script type="application/ld+json"> tag, and the ops preview renders the resulting HTML with srcDoc in an unsandboxed iframe. A manager/owner can save a template field such as ctaLabel containing </script><script>...</script>; when another restaurant member opens the email template preview, the script executes in a same-origin iframe and can issue authenticated ops requests. The visible HTML paths mostly call escapeHtml, but the JSON-LD script serialization does not escape '<', so the mitigation is incomplete.

## Recommendation

Escape JSON before embedding it in script tags, for example JSON.stringify(...).replace(/</g, '\\u003c'), or use a shared safeJsonStringify helper. Also sandbox the preview iframe without allow-scripts unless scripts are required, and consider rejecting script-breakout substrings in template fields as defense in depth.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-04)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.
