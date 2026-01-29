---
task: add-privacy-page
timestamp_utc: 2026-01-29T21:57:28Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [ ] Collect approved privacy policy text and effective date

## Core

- [x] Add `/privacy` page under `src/app/(public)/(marketing)`
- [x] Add metadata (title/description/canonical)
- [x] Include contact email and sections list

## UI/UX

- [x] Semantic headings and section anchors
- [x] Mobile-friendly layout (`guest-page`)

## Tests

- [x] `pnpm run build`
- [x] Chrome DevTools MCP QA (a11y + responsive)

## Notes

- Assumptions:
  - Using a template privacy policy pending legal approval
- Deviations:

## Batched Questions

- Provide policy content or approve a template
