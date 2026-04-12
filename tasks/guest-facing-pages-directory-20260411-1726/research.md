---
task: guest-facing-pages-directory
timestamp_utc: 2026-04-11T17:26:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Guest Facing Pages Directory

## Requirements

- Functional:
  - Create a human-readable page that lists the guest-facing pages in the product.
  - Categorize routes so marketing, booking, account, and support flows are easy to understand.
  - Base the list on the actual App Router structure instead of a one-off hard-coded page.
  - Keep the existing XML sitemap aligned with the same canonical route inventory where appropriate.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Page must use semantic headings, lists, and link text that work for keyboard and screen-reader users.
  - Avoid surfacing ops-only or dev-only routes.
  - Exclude auth-only or receipt-only routes from the XML sitemap where indexing is not appropriate.

## Existing Patterns & Reuse

- `src/app/sitemap.ts` already exposes a small hard-coded guest route list, but it is incomplete and includes routes that should not be indexed.
- Public/guest layouts already use `src/components/layouts/Footer.tsx` and the landing page uses `src/components/landing/shared/Footer.tsx`.
- Public informational pages such as `/contact` and `/privacy` use the `guest-page` content shell and section-based layout.
- Guest portal navigation in `src/components/layouts/GuestNavbar.tsx` confirms the core signed-in guest destinations.

## External Resources

- None required beyond the repo's current routing structure.

## Constraints & Risks

- Keep the route catalog canonical so the HTML directory and XML sitemap do not drift.
- Dynamic pattern routes like `/restaurants/[slug]` should be documented for humans, but placeholder paths should not be emitted directly into the XML sitemap.
- Some guest-facing routes are legacy redirects or helper routes; they should be labelled clearly instead of treated as primary destinations.

## Open Questions (owner, due)

- Q: Should the page be reachable from the public footer?
  A: Assumed yes, because a page directory is more useful if guests can discover it without typing the URL. Owner: github:@amanshresthaa. Due: 2026-04-11.

## Recommended Direction (with rationale)

- Add a shared guest-facing route catalog under `src/app/` so route metadata stays close to the app-router surface.
- Build a public `/site-map` page from that catalog with clear categories, access requirements, and route-type labels.
- Update `src/app/sitemap.ts` to consume the same catalog and include only truly indexable static pages.
- Add the new page to the public footer so it is actually reachable.
