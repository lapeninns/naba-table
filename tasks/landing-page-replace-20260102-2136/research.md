---
task: landing-page-replace
timestamp_utc: 2026-01-02T21:36:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Landing Page Replace

## Requirements

- Functional: Replace the public landing page client component with the supplied layout and copy.
- Non-functional (a11y, perf, security, privacy, i18n): Maintain semantic structure, keyboard access, and reduced-motion respect; no new data sources or PII.

## Existing Patterns & Reuse

- `src/components/landing/FactoryHomeClient.tsx` is the current landing client component.
- Use Shadcn UI primitives from `components/ui/button.tsx` and `components/ui/badge.tsx`.
- Maintain existing route entrypoint at `src/app/(public)/page.tsx`.

## External Resources

- None.

## Constraints & Risks

- Must use Shadcn primitives for UI.
- Avoid custom primitives; keep changes focused to the landing component.
- Inline style usage should be limited; required here to set theme CSS variables and stagger animations.

## Open Questions (owner, due)

- Q: None.

## Recommended Direction (with rationale)

- Replace `FactoryHomeClient` with the provided layout, adapting to existing Shadcn primitives and link routing to preserve existing app patterns.
