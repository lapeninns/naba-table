---
task: homepage-guest-copy-refresh
timestamp_utc: 2025-12-11T00:54:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Homepage guest copy refresh

## Requirements

- Functional: Refresh public homepage copy for restaurant guests with concise hero, benefits, and trust statements.
- Non-functional: Preserve layout, accessibility, and design-system usage; no new visual primitives.

## Existing Patterns & Reuse

- Public marketing surface lives in `src/app/(public)/page.tsx` with existing sections and design-system utilities.
- Frontend styling should rely on the established design system (see `Frontend Design` skill).

## External Resources

- Copy guidance provided in product brief (headline/CTA/social-proof playbook).

## Constraints & Risks

- Avoid layout regressions; keep CTA and structure intact.
- Must align with AGENTS rules (task artifacts, accessibility, no secrets).

## Open Questions (owner, due)

- None; copy supplied by requestor.

## Recommended Direction (with rationale)

- Update text strings in the homepage hero, social proof, testimonial, benefits, and pre-final CTA sections to the provided restaurant-guest messaging while keeping component structure unchanged.
