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

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-02)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.
