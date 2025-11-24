---
task: brand-migration-nabatable
timestamp_utc: 2025-11-24T13:05:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Brand migration to Nab a Table / Lapen Inns

## Requirements

- Functional:
  - Rebrand platform display name from **SajiloReserveX** to **Nab a Table** (customer-facing brand), keeping **Lapen Inns** as the parent company name where appropriate.
  - Remove legacy **Shipfast** template branding and **Marc** author attributions; replace these with **Lapen Inns** ownership/voice.
  - Update SEO/social metadata, marketing copy, emails, configs, docs, and package metadata to reflect the new brand(s).
- Non-functional (a11y, perf, security, privacy, i18n):
  - Preserve existing accessibility behaviors and layouts when updating copy.
  - Avoid breaking tests and date strings (e.g., words like “March” that contain “marc”).
  - Keep secrets out of source; no change to auth/PII handling expected.

## Existing Patterns & Reuse

- Central config: `config.ts` exposes `appName`, `appDescription`, `domainName`, and email sender names; many components read `config.appName`.
- SEO helper: `libs/seo.tsx` defines metadata defaults (title, OG/Twitter, schema author = Marc Lou) that can be swapped centrally.
- Marketing/landing copy: numerous hardcoded strings across `src/app` marketing routes and components (`OwnerMarketing*`, `MarketingSessionActions`, `GuestLandingPage`, `page.tsx`, etc.) plus CSS brand tokens in `src/app/globals.css`.
- Emails: server email templates (`server/emails/*`) embed `config.appName` and occasionally literal previous-brand strings.
- Package/docs: `package.json` previously named `ship-fast-code`; README/docs and quickstart notes referenced SajiloReserveX.
- Testimonials/features components (`components/Testimonials3/11`, `FeaturesGrid.tsx`) contain Shipfast/Marc-specific names/links.

## External Resources

- None needed yet; using in-repo patterns for brand + SEO.

## Constraints & Risks

- Large surface area for string replacements; risk of over-replacing “marc” inside month names (e.g., “March”).
- Domain for Nab a Table not explicitly provided; assumption will be `nabatable.com` unless clarified.
- Backups in `backups/` should likely remain untouched; focus on active code/docs to avoid integrity issues.
- Need manual UI QA (Chrome DevTools MCP) post-change because marketing surfaces change.

## Open Questions (owner, due)

- Q: Confirm canonical domain and social handles for Nab a Table (Twitter, etc.)? **Assume `nabatable.com` and `@nabatable` unless guidance arrives.** (owner: assistant; due before metadata finalization)
- Q: Should legacy Shipfast testimonials be replaced with Lapen Inns voices or removed? (owner: assistant; due during implementation—will rewrite copy to Lapen Inns case studies)

## Recommended Direction (with rationale)

- Update `config.ts` with the new brand values (display name = “Nab a Table”, domain = assumed `nabatable.com`, description to match reservation product, email from names to Nab a Table / Lapen Inns) so downstream components inherit branding.
- Refresh SEO defaults in `libs/seo.tsx` (Twitter creator, schema author) to Lapen Inns; remove Shipfast doc links.
- Replace hardcoded “SajiloReserveX” and Shipfast/Marc mentions across marketing pages, components, emails, README/docs with Nab a Table / Lapen Inns language; keep tests intact by checking contexts (months vs names).
- Rename package metadata (`package.json` name) and default mock emails in `libs/resend.ts` away from shipfast.
- Plan targeted manual QA on marketing landing pages and email preview route to confirm branding propagates.
