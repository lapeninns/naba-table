# [HIGH] Email template preview can execute same-origin script

**File:** [`src/app/app/(app)/email-templates/page.tsx`](<https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/app/(app)/email-templates/page.tsx#L10-L11>) (lines 10, 11)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `xss`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

This page mounts OpsEmailTemplatesClient, which reaches the email template preview flow. The preview pane renders server-returned email HTML as iframe srcDoc without a sandbox (src/components/features/email-templates/EmailTemplatesPreviewPane.tsx:181, components/ui/iframe.tsx:9). Tracing the preview source shows renderRestaurantBookingEmailPreview passes editable template data such as ctaLabel into renderHtml (server/emails/bookings.ts:961-972). renderAnnotationScript then embeds annotation fields with raw JSON.stringify inside a <script type="application/ld+json"> block (server/emails/base.ts:94). The template schema permits '<' and '</script>' in ctaLabel up to 60 chars (src/app/api/ops/restaurants/schema.ts:286). An owner/manager can save or preview a CTA label like </script><script>parent.fetch('/api/ops/...')</script>; when another ops user opens this page's preview, the JSON-LD script is terminated early and the injected script runs in a same-origin iframe, allowing authenticated ops API calls as the viewer.

## Recommendation

Serialize inline JSON with a safe helper such as JSON.stringify(value).replace(/</g, '\\u003c'), and sandbox the preview iframe without allow-scripts or allow-same-origin. Rejecting script delimiter characters in editable template fields would add defense in depth.

## Revalidation

**Verdict:** fixed

The page still mounts OpsEmailTemplatesClient and the preview still uses iframe srcDoc, but the iframe now passes sandbox="" and referrerPolicy="no-referrer". An empty sandbox attribute disables scripts and same-origin privileges, so injected script in the srcDoc cannot execute with the parent ops origin. The JSON-LD path is also patched: server/emails/base.ts now serializes annotation data with safeJsonForHtmlScript, which escapes '<', '>', '&', and line separators, preventing a </script> delimiter from terminating the JSON-LD script. The exact ctaLabel payload in the finding is additionally rejected by the current emailTemplateVariantSchema because ctaLabel uses plainTextSchema and SCRIPT_DELIMITER_REGEX. A regression test exists for safeJsonForHtmlScript with the same </script><script>alert(1)</script> pattern. The described same-origin iframe script execution path is therefore patched in the current code.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-02)
