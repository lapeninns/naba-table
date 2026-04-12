---
task: guest-facing-pages-directory
timestamp_utc: 2026-04-11T17:26:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Create a shared guest-facing route catalog
- [x] Add the public `/site-map` page

## Core

- [x] Categorize the guest-facing routes with access and route-type metadata
- [x] Rewire `src/app/sitemap.ts` to use the shared catalog
- [x] Add public footer navigation to the new page

## UI/UX

- [x] Responsive layout
- [x] Semantic headings and list structure
- [x] Clear labels for public/auth-only/pattern/redirect entries

## Tests

- [x] Unit coverage for route catalog / sitemap filtering
- [x] Manual browser verification with Chrome DevTools MCP

## Notes

- Assumptions: `/site-map` is the desired public URL and should be discoverable from the footer.
- Deviations: the XML sitemap only emits static indexable pages; dynamic patterns are documented on `/site-map` but intentionally excluded from `sitemap.xml`.

## Batched Questions

- None at the moment.
