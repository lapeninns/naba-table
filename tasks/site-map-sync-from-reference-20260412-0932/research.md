---
task: site-map-sync-from-reference
timestamp_utc: 2026-04-12T09:32:38Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Site-map sync from reference branch

## Requirements

- Functional:
  - Bring the guest-facing `/site-map` experience from the reference branch onto `Guest-Facing-Frontend`.
  - Reuse the same canonical guest route inventory for both the human-readable `/site-map` page and `src/app/sitemap.ts`.
  - Add a discoverable footer link to `/site-map`.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Keep the page server-rendered and link-only for low interaction overhead.
  - Preserve semantic navigation and heading structure.
  - Do not expose private or auth-gated routes in the XML sitemap.

## Existing Patterns & Reuse

- Current branch already has `src/app/sitemap.ts`, but it hardcodes a small route list and does not share data with a human-readable page.
- Reference implementation lives on `origin/codex/FrontendImprovementsofguestfacing` in:
  - `src/app/guest-facing-pages.ts`
  - `src/app/(public)/(marketing)/site-map/page.tsx`
  - `src/app/sitemap.ts`
  - `src/components/layouts/Footer.tsx`
- Current branch route inventory matches the reference closely enough to port that implementation directly.

## External Resources

- None required; this is an in-repo branch-to-branch sync.

## Constraints & Risks

- `public/sitemap.xml` and `public/sitemap-0.xml` are stale static artifacts in the current branch; this task will not delete them without an explicit request.
- Footer links must only point to routes that exist on the current branch.
- UI change requires Chrome DevTools verification and artifacts per repo policy.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Port the shared guest route catalog and `/site-map` page from `origin/codex/FrontendImprovementsofguestfacing`.
- Keep `src/app/sitemap.ts` minimal by deriving entries from the shared catalog.
- Update the footer’s legal/support links to use real guest-facing routes instead of placeholders.
