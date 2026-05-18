# [HIGH] Stored javascript: URL can execute from public restaurant links

**File:** [`src/components/features/restaurant-settings/RestaurantProfileSection.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/features/restaurant-settings/RestaurantProfileSection.tsx#L457) (lines 457)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `xss`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

RestaurantProfileSection renders ContactLocationSubform at line 457, which lets an admin save Google Maps and review URLs. The traced validation only checks URL parseability/z.string().url() and does not restrict schemes, so values such as javascript:alert(1) or data: URLs can be persisted. The public restaurant page later uses the stored googleMapUrl directly as an anchor href for the Open map CTA. A malicious or compromised restaurant admin can therefore store a script URL that executes when guests click the public map link.

## Recommendation

Use a shared URL validator that only permits https: URLs, ideally restricted to expected Google Maps/Review hosts. Apply it in the client form model, API schemas, and server-side persistence helpers, and clean up any existing unsafe stored URLs.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-02)
