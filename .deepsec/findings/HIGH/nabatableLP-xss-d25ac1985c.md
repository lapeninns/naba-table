# [HIGH] Restaurant profile fields can seed stored XSS in email previews

**File:** [`src/components/features/restaurant-settings/RestaurantProfileSection.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/features/restaurant-settings/RestaurantProfileSection.tsx#L441-L457) (lines 441, 457)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `xss`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

This component exposes restaurant name/profile and contact/location fields through BrandIdentitySubform and ContactLocationSubform. Tracing those values shows they are later used in booking email Schema.org JSON-LD (`server/emails/base.ts`) via plain JSON.stringify inside a script tag, and previewed in an unsandboxed srcDoc iframe. A manager can store a value such as `</script><script>alert(1)</script>` in text fields, or in a URL path accepted by the current URL validation, causing script execution when staff preview affected booking emails.

## Recommendation

Use a safe JSON serializer for script contexts that escapes `<`/`</script>` (for example `<` to `\u003c`), sandbox email preview iframes, and restrict profile URLs to expected https/http schemes and preferably Google hosts for map/review fields.

## Revalidation

**Verdict:** fixed

A manager can still store profile text such as restaurant name or address, and not every profile text field rejects script-looking text at validation time. The relevant email sinks are now safe: renderHtml escapes visible venue/profile-derived content with escapeHtml, including venue.name and venue.address. The Schema.org JSON-LD block in server/emails/base.ts no longer uses raw JSON.stringify in a script context; renderAnnotationScript calls safeJsonForHtmlScript, which escapes <, >, &, and line separators so </script><script> payloads cannot terminate the JSON-LD script. There is a Vitest covering this exact script-breakout pattern in tests/lib/security/script-json.test.ts. The preview iframe in EmailTemplatesPreviewPane now renders srcDoc with sandbox="" and referrerPolicy="no-referrer", so scripts inside preview HTML are also blocked by the browser. These mitigations were added in commit 020a7389, so the described stored-XSS email preview chain is patched.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-08)
