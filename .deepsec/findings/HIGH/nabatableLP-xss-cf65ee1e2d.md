# [HIGH] Stored XSS through custom email template fields in ops preview

**File:** [`server/restaurants/emailTemplates.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/restaurants/emailTemplates.ts#L83-L149) (lines 83, 139, 149)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `xss`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

upsertRestaurantEmailTemplate persists admin-controlled variant fields directly into restaurants.email_templates. Those fields later flow into the email preview HTML. Visible email body text is escaped, but server/emails/base.ts renders the same values into a JSON-LD script using raw JSON.stringify(...), and src/components/features/email-templates/EmailTemplatesPreviewPane.tsx renders preview.html into an iframe srcDoc without a sandbox. A payload such as ctaLabel="</script><script>fetch('/api/ops/restaurants')</script>" passes the template schema length checks, is stored by this helper, breaks out of the JSON-LD script, and executes when another restaurant member views the preview. The app CSP in src/proxy.ts does not set script-src, so it does not mitigate inline script execution.

## Recommendation

Escape JSON embedded in script tags with a safeJsonStringify implementation that encodes '<' as '\u003c' or '</' as '<\/'; also sandbox the preview iframe without allow-scripts unless script execution is required. Consider rejecting '<' in template fields as defense in depth.

## Revalidation

**Verdict:** fixed

The active shipped email templates page is /app/email-templates, which renders OpsEmailTemplatesClient and EmailTemplatesPreviewPane. That preview pane passes sandbox="" and referrerPolicy="no-referrer" to the iframe, so scripts in srcDoc are not allowed to execute and the frame is not same-origin. The older restaurant-settings EmailTemplatesSection contains an unsandboxed iframe, but grep showed it is not imported by a shipped page and the old settings route redirects to /app/email-templates. The server-side JSON-LD sink is also fixed with safeJsonForHtmlScript, which prevents </script> breakout even before sandboxing matters. The update schema now rejects script markup in ctaLabel, subject, headline, and intro, and visible fields are HTML-escaped. The described same-origin ops preview XSS chain is therefore patched in the current code.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
