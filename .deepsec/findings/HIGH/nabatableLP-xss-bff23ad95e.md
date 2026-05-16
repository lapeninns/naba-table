# [HIGH] Unsandboxed email preview can execute template-controlled script

**File:** [`src/components/features/email-templates/EmailTemplatesPreviewPane.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/features/email-templates/EmailTemplatesPreviewPane.tsx#L179-L181) (lines 179, 181)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `xss`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The preview pane renders server-provided email HTML directly with iframe srcDoc at line 181, and it does not pass a sandbox attribute. The shared Iframe component is only a thin iframe wrapper, so srcDoc content runs as a same-origin document with script execution allowed. The traced renderer escapes visible template text, but server/emails/base.ts emits JSON-LD as `<script type="application/ld+json">${JSON.stringify(schema)}</script>` without escaping `<`. Template-controlled fields such as ctaLabel are included in that schema, and the API schema allows arbitrary text up to length limits. A malicious saved value like `</script><script>parent.fetch('/api/ops/...')</script>` breaks out of the JSON-LD script and executes when another staff member opens the email template preview.

## Recommendation

Make the preview iframe inert by default, for example `sandbox=""` with no `allow-scripts` or `allow-same-origin`, and also fix the email renderer to safely serialize JSON-LD by escaping `<` such as `JSON.stringify(schema).replace(/</g, '\\u003c')`.

## Revalidation

**Verdict:** fixed

The current target file no longer matches the vulnerable code described in the finding. EmailTemplatesPreviewPane renders preview.html through the shared Iframe, but it now passes sandbox="" and referrerPolicy="no-referrer" alongside srcDoc. The shared components/ui/iframe.tsx wrapper simply forwards iframe props, so the empty sandbox attribute reaches the browser and disables scripts without allow-scripts or allow-same-origin. I also traced the server renderer: server/emails/base.ts now imports safeJsonForHtmlScript and uses it for the JSON-LD script body, and lib/security/script-json.ts escapes <, >, &, U+2028, and U+2029. That means a ctaLabel like </script><script>...</script> is serialized as \u003c/script\u003e... and cannot break out of the JSON-LD script. The preview API still accepts draft variants, but the current iframe sandbox alone blocks script execution even if malicious HTML reached srcDoc. Git blame shows both the iframe sandbox and safe JSON serializer were added in 020a7389, and existing regression tests assert both defenses.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-11)
