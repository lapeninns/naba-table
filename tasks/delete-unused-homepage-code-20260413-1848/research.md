---
task: delete-unused-homepage-code
timestamp_utc: 2026-04-13T18:48:00Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Research: Delete Unused Homepage Code

## Requirements

- Functional:
  - Keep the live `/` homepage route unchanged on the canonical path at `src/app/(public)/page.tsx`.
  - Remove alternate homepage implementations and supporting files that are no longer imported anywhere.
  - Remove commented-out landing helpers that are not wired into the active homepage.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Preserve the current homepage behavior, redirects, and accessibility characteristics.
  - Avoid deleting shared helpers that are still used by active landing sections.
  - Keep the cleanup scoped to dead code rather than broad landing-page refactors.

## Existing Patterns & Reuse

- The active homepage route is `src/app/(public)/page.tsx`, which renders `src/components/landing/LandingPage.tsx` inside `MarketingLayout`.
- The active landing composition uses `src/components/landing/sections/*`, `src/components/landing/shared/*`, `src/components/landing/seo/*`, and `src/components/landing/optimizations/LazySection.tsx`.
- `FactoryHomeClient.tsx`, `HomeSections.tsx`, `components/owner-marketing/*`, and `components/marketing/*` have no runtime imports in the repo.
- `ExitIntentPopup.tsx` and `StickyCTA.tsx` are only referenced by commented-out lines in `LandingPage.tsx`.

## External Resources

- None needed; this is a repo-internal dependency cleanup.

## Constraints & Risks

- Deleting files is irreversible in the branch diff, so each target must be confirmed as unreferenced before removal.
- `src/components/landing/shared/*` contains both dead and live helpers; only the live-path helpers should remain.
- Docs may still mention deleted marketing files historically, but changing unrelated docs is out of scope unless the cleanup breaks tooling.

## Open Questions (owner, due)

- Q: Should dormant-but-commented landing helpers be retained for future experiments?
  A: No. The request is to delete unused homepage code, and these helpers are not active in the canonical homepage path. Owner: github:@amanshresthaa, due: 2026-04-13

## Recommended Direction (with rationale)

- Delete the unreferenced alternate homepage trees and their orphaned data files.
- Remove the commented references from `LandingPage.tsx` and prune now-unused barrel exports in nearby landing folders.
- Verify the live homepage still loads cleanly and run focused static validation after the cleanup.
