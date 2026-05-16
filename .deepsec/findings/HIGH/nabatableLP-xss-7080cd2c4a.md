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

## Revalidation

**Verdict:** fixed

The current schema adds plainTextSchema checks that reject script delimiters in subject, headline, intro, and ctaLabel, including payloads such as </script><script>alert(1)</script>. More importantly, the JSON-LD sink in server/emails/base.ts now uses safeJsonForHtmlScript instead of raw JSON.stringify output, escaping '<', '>', '&', and line separators before embedding data in the script tag. That protects both saved malicious variants and crafted draft previews even if a field is not covered by the delimiter refinement. The shipped EmailTemplatesPreviewPane iframe now passes sandbox="", so scripts in srcDoc are not allowed to execute in the ops origin. The visible email body continues to use escapeHtml for author-controlled copy. I verified the targeted script-json and restaurant-security-schema tests pass.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
