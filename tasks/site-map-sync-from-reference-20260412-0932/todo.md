---
task: site-map-sync-from-reference
timestamp_utc: 2026-04-12T09:32:38Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Inspect current branch sitemap implementation and reference branch files.
- [x] Create task folder and artifacts directory.

## Core

- [x] Add shared guest-facing route catalog.
- [x] Add `/site-map` page using the shared catalog.
- [x] Update `src/app/sitemap.ts` to reuse the shared sitemap entries.

## UI/UX

- [x] Update footer support links to include `/site-map` and only valid routes.
- [x] Verify semantic headings, nav labels, and route badges on `/site-map`.

## Tests

- [x] TypeScript check
- [x] Browser verification of `/site-map`
- [x] Browser verification of `/sitemap.xml`

## Notes

- Assumptions:
  - The reference branch `origin/codex/FrontendImprovementsofguestfacing` is the intended source.
- Deviations:
  - This task ports the implementation directly instead of cherry-picking the full branch, to keep the diff scoped to sitemap-related files.
  - Untracked generated metadata files in `public/` were moved to `~/.Trash/` so the canonical App Router `robots.ts` and `sitemap.ts` routes could serve without Next.js path conflicts.

## Batched Questions

- None.
