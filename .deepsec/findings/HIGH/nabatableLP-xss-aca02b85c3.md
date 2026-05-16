# [HIGH] Email preview HTML can execute script through unsafe JSON-LD serialization

**File:** [`src/app/api/ops/restaurants/[id]/email-templates/[templateKey]/preview/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/email-templates/[templateKey]/preview/route.ts#L39-L60) (lines 39, 60)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `xss`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The preview route accepts draft template variants, renders them with renderRestaurantBookingEmailPreview, and returns preview.html. The template schema allows '<' and '</script>' in fields such as ctaLabel. That ctaLabel flows into server/emails/base.ts renderAnnotationScript, which embeds JSON.stringify(schema) directly inside a <script type="application/ld+json"> block. A value like </script><script>parent.fetch('/api/ops/...')</script> breaks out of the JSON-LD script. The ops UI renders this returned HTML with an unsandboxed iframe srcDoc in EmailTemplatesPreviewPane, so the injected script runs in a same-origin frame and can issue authenticated ops requests as the viewing user. Stored template variants make this exploitable against other restaurant members when they open the preview.

## Recommendation

Serialize inline JSON with a safe helper that escapes '<' such as JSON.stringify(schema).replace(/</g, '\u003c'), and sandbox the preview iframe without allow-scripts or allow-same-origin. Rejecting script delimiter characters in editable template fields would add defense in depth.

## Revalidation

**Verdict:** fixed

The exact JSON-LD breakout described is no longer viable. renderAnnotationScript now returns <script type="application/ld+json">${safeJsonForHtmlScript(schema)}</script> instead of raw JSON.stringify(schema), and safeJsonForHtmlScript replaces every < with \u003c. Therefore ctaLabel text such as </script><script>parent.fetch(...)</script> remains JSON string data and does not close the script element. The preview request schema also blocks script markup in ctaLabel and other primary editable text fields before renderRestaurantBookingEmailPreview receives draft variants. The preview iframe is now sandboxed with an empty sandbox attribute, so scripts are disabled even if another HTML injection path were introduced later. Existing persisted template data is also mitigated at render time by the safe serializer. Commit 020a7389 contains these changes, including the new lib/security/script-json.ts helper and the sandbox/referrerPolicy additions to EmailTemplatesPreviewPane.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
