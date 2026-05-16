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

## Revalidation

**Verdict:** fixed

Template-controlled strings still flow through email template normalization and interpolation, but the JSON-LD script context is no longer raw. renderAnnotationScript now calls safeJsonForHtmlScript(schema), which converts '<' to \u003c and therefore prevents a </script> delimiter from being interpreted by the HTML parser. The visible HTML paths in server/emails/bookings.ts use escapeHtml for headline, intro, venue/address text, renderNote for cue/ask, and renderButton for ctaLabel/href. The current preview API validates draft variants through previewRestaurantEmailTemplateSchema, and the main preview pane uses a sandboxed iframe with no allow-scripts. A read-only restaurant member can still render saved templates, but the saved payload cannot break out of JSON-LD or execute in the shipped preview frame. This is a fixed historical issue rather than a current exploitable XSS.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-04)
