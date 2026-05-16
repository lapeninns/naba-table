# [HIGH] Email template preview allows script breakout into same-origin iframe

**File:** [`src/app/api/ops/restaurants/schema.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/schema.ts#L277-L363) (lines 277, 286, 295, 361, 363)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `xss`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The email template schemas accept arbitrary text for variant fields, including ctaLabel, and previewRestaurantEmailTemplateSchema allows caller-supplied variants. These values flow into renderRestaurantBookingEmailPreview and then into renderAnnotationScript, which embeds JSON.stringify(schema) inside a <script type="application/ld+json"> tag. A value such as </script><script>...</script> can break out of that JSON-LD script. The resulting preview.html is rendered by EmailTemplatesPreviewPane via an unsandboxed iframe srcDoc, so the injected script runs in a same-origin frame. HTML escaping in the visible email body does not mitigate this JSON-LD script sink.

## Recommendation

Escape JSON used in script tags with a safeJsonStringify helper that replaces at least '<' with '\u003c' or '</' with '<\/'; also sandbox the preview iframe without script privileges where possible. Treat schema-level rejection of script-breaking sequences as defense in depth, not the primary fix.

## Revalidation

**Verdict:** fixed

The draft preview route still accepts caller-supplied variants, but it validates them with previewRestaurantEmailTemplateSchema, which reuses the hardened update variant schema. The JSON-LD renderer now serializes with safeJsonForHtmlScript, so a ctaLabel containing </script> is emitted as escaped Unicode and cannot terminate the script element. EmailTemplatesPreviewPane also renders preview.html in an iframe with sandbox="", removing same-origin script execution even if another HTML sink were introduced. The email HTML body escapes the visible headline, intro, cue, ask, button label, title, and preheader. The older restaurant-settings preview component has an unsandboxed iframe but is not imported by any shipped page I found, and the server-side JSON-LD escaping still neutralizes this specific breakout. The current code therefore patches the described same-origin iframe XSS.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
