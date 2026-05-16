# [HIGH] Email template preview can execute saved template content as same-origin script

**File:** [`src/hooks/ops/useOpsEmailTemplatesPageState.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/hooks/ops/useOpsEmailTemplatesPageState.ts#L203-L315) (lines 203, 208, 313, 315)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `xss`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

This hook sends editable template variants to the preview API and saves those same variants for the restaurant. Template fields such as ctaLabel pass validation with strings like `</script><script>parent.fetch('/api/ops/restaurants')</script>`. The preview renderer later places ctaLabel into a JSON-LD script via raw `JSON.stringify` in `server/emails/base.ts`, which does not escape `</script>`, and the preview UI renders `preview.html` in an unsandboxed `srcDoc` iframe. Because `srcDoc` iframes are same-origin when not sandboxed, a stored malicious variant can execute script in the ops origin when another restaurant member opens the email templates page.

## Recommendation

Use a safe JSON serializer for inline scripts that escapes `<` as `\u003c` or `</` as `<\/`, and render the email preview iframe with a restrictive sandbox that does not allow scripts. Consider also rejecting script terminators in template fields as defense in depth.

## Revalidation

**Verdict:** fixed

The hook still sends draft variants to the preview mutation and persists variants on save, so I traced the preview route, validation schema, renderer, and iframe. The current API schema validates preview and update variants through updateRestaurantEmailTemplateSchema; ctaLabel, subject, headline, intro, and other main copy fields use plainTextSchema, which rejects script markup such as </script>. More importantly, server/emails/base.ts no longer embeds the annotation with raw JSON.stringify; renderAnnotationScript now uses safeJsonForHtmlScript, which escapes <, >, &, and line separators before insertion into the script tag. The preview UI also no longer uses an unsandboxed iframe: EmailTemplatesPreviewPane renders the shared Iframe with sandbox="", so scripts are disabled and the frame is not same-origin. Normal HTML body fields are escaped by the email renderer as well. These mitigations were introduced in commit 020a7389. The original breakout payload would now either fail validation, be escaped inside JSON-LD, or be unable to execute in the sandboxed preview.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-04)
