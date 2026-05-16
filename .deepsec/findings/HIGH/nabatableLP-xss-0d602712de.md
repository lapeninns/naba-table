# [HIGH] Stored restaurant fields can break out of the email preview script tag

**File:** [`src/services/ops/restaurants.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/services/ops/restaurants.ts#L935-L1397) (lines 935, 1250, 1397)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `xss`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The service can update restaurant profile fields and later fetches email preview HTML as `preview.html`. Tracing that preview path shows the server embeds venue data in an inline `application/ld+json` script with raw `JSON.stringify(schema)`, and the client renders the returned HTML in an unsandboxed `iframe srcDoc`. Because `JSON.stringify` does not escape `</script>`, a manager or owner can store a restaurant name/address containing a script-breakout payload and execute JavaScript in the ops origin when another ops user opens the email template preview.

## Recommendation

Use a safe JSON serializer for inline scripts that escapes `<`, `>`, `&`, and line separators, and sandbox the email preview iframe without script execution unless scripts are strictly required.

## Revalidation

**Verdict:** fixed

The service can still update restaurant profile data and fetch preview HTML, so I traced the venue mapping, email renderer, and preview iframe. The vulnerable inline JSON-LD sink has been fixed: server/emails/base.ts imports safeJsonForHtmlScript and renderAnnotationScript embeds the escaped serialization instead of raw JSON.stringify(schema). That serializer replaces <, >, &, U+2028, and U+2029, so a restaurant name or address containing </script><script> no longer terminates the script element. Visible email fields such as venue name and address are also passed through escapeHtml in the email template. The preview pane renders srcDoc through an iframe with sandbox="", so scripts would be disabled even if markup reached the frame. Restaurant Google map/review URLs are also normalized with safeGoogleMapsUrl/safeGoogleReviewUrl before being used in email CTA decisions. These fixes are present in commit 020a7389. A stored restaurant field payload cannot execute script through the current ops preview path.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
