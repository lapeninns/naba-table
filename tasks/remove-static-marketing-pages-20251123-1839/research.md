---
task: remove-static-marketing-pages
timestamp_utc: 2025-11-23T18:39:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Remove static marketing pages & CTA

## Requirements

- Functional: delete public routes `/contact`, `/product`, `/privacy-policy`, `/terms` and remove navigation/footer CTAs pointing to them or other now-invalid targets.
- Functional (follow-up): remove `/partners` route; keep `/thank-you` for post-booking; clarify `/item/:slug` purpose.
- Non-functional: keep build passing; avoid broken links; maintain accessibility and layout integrity.

## Existing Patterns & Reuse

- Marketing layout uses `components/owner-marketing/OwnerMarketingNavbar.tsx` and `OwnerMarketingFooter.tsx` for links/CTA.
- Pages live under `src/app/(marketing)/{contact,product,privacy-policy,terms}/page.tsx`.

## Constraints & Risks

- Removing routes could leave orphaned links; must sweep for references.
- CTA currently targets `/ops/login` which is non-existent; should be removed per request.
- `/item/:slug` must be explained or redirected to avoid duplicate booking entrypoints.

## Open Questions

- None; user explicitly asked to delete the pages and CTA.

## Recommended Direction

- Delete the four marketing route directories.
- Remove nav/footer links to those pages and the console CTA entry.
- Run link/route sweep to confirm no remaining references.
