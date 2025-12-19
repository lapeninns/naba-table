---
task: dead-links
timestamp_utc: 2025-12-04T13:45:00Z
owner: github:@amankumarshrestha
reviewers: []
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Remove Dead Links & CTAs

## Objective

Ensure all links/CTAs point to valid destinations; eliminate references to 404 pages.

## Success Criteria

- [ ] Guest/marketing nav/footer CTAs point to live pages (no 404s) and still keyboard accessible.
- [ ] Booking wizard close/CTA flows land on valid thank-you routes.
- [ ] Sitemap lists only valid URLs; local QA confirms no 404s for linked paths.

## Architecture & Components

- Touch points: `components/customer/navigation/CustomerNavbar.tsx`, `components/layout/Footer.tsx`, `components/reserve/steps/ConfirmationStep.tsx`, `src/app/sitemap.ts`, `src/app/app/(app)/walk-in/_components/WalkInWizardClient.tsx`, `src/components/features/tables/timeline/TableTimelineClient.tsx`, `next.config.js` redirects.
- Update/remove CTA buttons/links referencing missing routes; keep styling unchanged.

## Data Flow & API Contracts

- N/A (static links/CTAs only).

## UI/UX States

- Ensure fallback/empty states remain clear after CTA removal.

## Edge Cases

- Dynamic routing or query params causing 404.
- Links generated from config/constants reused across pages.
- Ops shell nav links must match `/app/*` routes; avoid breaking match logic.

## Testing Strategy

- Static code search for links to removed/non-existent routes.
- Run dev server & crawl key pages to confirm 404 absence.
- Manual QA with Chrome DevTools MCP per policy (once UI changes made).

## Rollout

- No feature flag; direct fix.
- Verify locally before merging.
