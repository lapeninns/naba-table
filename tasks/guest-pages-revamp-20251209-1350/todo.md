---
task: guest-pages-revamp
timestamp_utc: 2025-12-09T13:50:00Z
owner: github:@factory-droid
reviewers:
  - github:@maintainers
risk: high
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [ ] Inventory existing `/restaurants` pages/components and determine which logic can be reused.
- [ ] Scaffold `src/components/design-system/public/` with shared sections.

## Core (Batch 1 — Public Categories)

- [ ] Implement listing hero/filters grid per design system.
- [ ] Build reusable card/list modules for restaurant categories.
- [ ] Update `src/app/(public)/(marketing)/restaurants/page.tsx` to compose new components.
- [ ] Align `/restaurants/[slug]` and `/restaurants/[slug]/book` hero/sections with tokens.
- [ ] Refresh thank-you pages to use new CTA + summary components.

## UI/UX

- [ ] Verify headings hierarchy, focus states, and responsive behavior per page.
- [ ] Ensure CTA links maintain existing navigation (book, sign-in, guest bookings).

## Tests

- [ ] `pnpm run lint`
- [ ] `pnpm run test`
- [ ] Chrome DevTools MCP for each updated page; attach Lighthouse + HAR in `artifacts/`.

## Notes

- Assumptions: data fetching remains server-side; only presentation changes.
- Deviations: document any API change need before implementation.
