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

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-02)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.
