---
task: dead-links
timestamp_utc: 2025-12-04T13:45:00Z
owner: github:@amankumarshrestha
reviewers: []
risk: medium
flags: []
related_tickets: []
---

# Research: Remove Dead Links & CTAs

## Requirements

- Functional: Identify and remove dead links/CTAs and pages returning 404. Ensure navigation and CTAs route to valid destinations.
- Non-functional (a11y, perf, security, privacy, i18n): Avoid broken keyboard focus/ARIA from removed elements; maintain performance; no new security/privacy concerns.

## Existing Patterns & Reuse

- Navigation & CTA surfaces live in shared components (e.g., `components/layout/Footer.tsx`, `components/customer/navigation/CustomerNavbar.tsx`, `components/layout/Header/Header.tsx`). Reuse these instead of introducing new shells.
- Guest routing rules documented in `guest-facing-routes.md`; route map generated via `node route-scanner.js` (36 page routes, 69 API routes) saved to `route-map.json`.
- Booking wizard confirmation flows already default to `/guest/thank-you` via `ReservationWizard`.

## External Resources

- N/A (internal audit task).

## Constraints & Risks

- Risk of removing links that appear dead in code but are used dynamically; need to confirm with runtime checks.
- Possible SEO impact if pages removed without redirects.
- Terms/privacy destinations do not exist; removing links reduces legal discoverability—should align with stakeholders.

## Open Questions (owner, due)

- Which routes are expected to exist vs deprecated? (owner: TBD)
- Should `/reserve` CTA point to `/restaurants` (browse) or `/guest/bookings` (manage)?
- Is there a canonical location for Terms/Privacy content, or should links be removed entirely?

## Recommended Direction (with rationale)

- Inventory routes and CTAs via static search and route map; confirm 404 targets; remove or retarget dead references.
- Retarget `/reserve` CTAs/redirects to a live path (likely `/restaurants`) to avoid redirecting to nonexistent `/bookings` list.
- Align sitemap entries with actual routes (`/`, `/restaurants`, `/auth/signin`, `/guest/thank-you`, `/guest/bookings`).
- Remove/neutralize links to missing legal pages (`/terms`, `/privacy-policy`) unless a real destination exists.
- Update booking wizard confirmation close handler to use canonical `/guest/thank-you` instead of dead `/thank-you`.
