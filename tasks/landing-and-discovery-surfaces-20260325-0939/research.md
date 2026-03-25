---
task: landing-and-discovery-surfaces
timestamp_utc: 2026-03-25T09:39:00Z
owner: github:@factory-droid
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: landing-and-discovery-surfaces

## Requirements

- Functional:
  - Move `/` onto the warm guest-first discovery hierarchy while preserving authenticated redirect to `/guest/dashboard`.
  - Align `/restaurants` and `/restaurants/[slug]` with the same guest shell and component language.
  - Make restaurant detail and booking entry CTAs explicit.
  - Show deterministic, guest-friendly discovery empty states.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Keep guest routes inside canonical guest shell primitives and avoid ops/admin chrome.
  - Preserve centralized route ownership and redirect behavior.
  - Maintain accessible headings, CTA labels, and empty-state messaging.

## Existing Patterns & Reuse

- `src/components/layouts/MarketingLayout.tsx` is the guest-owned marketing shell for public discovery.
- `src/components/guest/ui/GuestPrimitives.tsx` provides canonical guest page shell, sections, cards, and empty/error/status primitives.
- `src/components/restaurants/PublicSections.tsx` currently contains bespoke restaurant list/detail sections that drift from canonical guest primitives.
- `src/components/landing/LandingPage.tsx` still uses the legacy landing stack (`components/landing/sections/*`) and its own navbar/footer treatment.

## External Resources

- No external resources required; mission library and repo patterns were sufficient.

## Constraints & Risks

- Scope must stay within landing/discovery surfaces; no auth or booking lifecycle rewrites beyond preserved redirect behavior.
- Avoid introducing another guest shell or one-off typography system.
- Existing Playwright specs still reference an older localhost:5180 marketing experience and may need alignment with the current guest surface behavior.

## Open Questions (owner, due)

- Q: Whether legacy marketing content should remain available after guest-first landing migration.
  A: For this feature, prioritize the assigned guest discovery behavior and keep changes limited to `/` plus restaurant discovery surfaces.

## Recommended Direction (with rationale)

- Rebuild landing and restaurant discovery pages around `MarketingLayout` + `GuestPrimitives` so they share shell, spacing, CTA hierarchy, and empty-state language.
- Update tests first to assert guest-first hierarchy and explicit discovery CTAs, then implement the canonical guest patterns needed to make those assertions pass.
