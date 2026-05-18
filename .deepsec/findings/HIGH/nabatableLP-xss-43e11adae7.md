# [HIGH] Unsandboxed email preview can execute template-controlled HTML

**File:** [`src/components/features/email-templates/EmailTemplatesPreviewPane.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/features/email-templates/EmailTemplatesPreviewPane.tsx#L181) (lines 181)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `xss`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The preview pane renders server-generated email HTML directly with `srcDoc={preview.html}` and no iframe sandbox. The shared `Iframe` component forwards props to a normal iframe, so `srcDoc` scripts run in a same-origin frame unless blocked elsewhere. Tracing the HTML source shows `renderRestaurantBookingEmailPreview` builds HTML through `renderEmailBase`; `server/emails/base.ts` writes `JSON.stringify(schema)` directly inside a JSON-LD script tag without escaping `</script>`. The schema includes `annotation.actionName`, which comes from the editable template `ctaLabel`, and venue name/address fields. An owner or manager can save a CTA label such as `</script><script>fetch('/api/ops/...')</script>`; when staff open the template preview, that script can execute in the ops origin and issue authenticated API requests as the victim.

## Recommendation

Do both defenses: render previews in an iframe with a restrictive sandbox such as `sandbox=""` or at most `sandbox="allow-same-origin"` without scripts, and fix the email renderer to safely serialize JSON for script contexts by escaping `<`/`</script>` or using a `safeJsonStringify` helper.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-04)
