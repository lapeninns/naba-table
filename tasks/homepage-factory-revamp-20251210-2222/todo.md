---
task: homepage-factory-revamp
timestamp_utc: 2025-12-10T22:22:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Create task folder with research/plan stubs.

## Core

- [x] Add client Factory homepage component (hero/search, live feed, bento metrics, feature block, footer) with scoped tokens.
- [x] Wire `src/app/(public)/page.tsx` to render the new component, preserving auth-aware CTA and marketing shell.

## UI/UX

- [x] Ensure responsive grid and stacking; align with Factory aesthetic.
- [x] Confirm focus/labels on inputs and buttons; respect `prefers-reduced-motion`.

## Tests

- [x] Run `pnpm lint`.
- [x] Manual QA via Chrome DevTools MCP on homepage; capture desktop & mobile screenshots to artifacts.

## Notes

- Assumption: keep shared navbar/footer shell from MarketingLayout.
- Deviation: None yet.
