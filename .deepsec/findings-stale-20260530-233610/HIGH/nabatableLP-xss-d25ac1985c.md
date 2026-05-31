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

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-02)
