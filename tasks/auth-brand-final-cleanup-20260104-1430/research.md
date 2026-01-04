---
task: auth-brand-final-cleanup
timestamp_utc: 2026-01-04T14:30:00Z
owner: github:@opencode
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Research: Auth Brand Final Cleanup

## Requirements

- Functional:
  - Fix React hydration errors (nested `<a>` tags).
  - Unify logo path in `BrandIcon.tsx` and `icon.svg`.
  - Ensure `/auth` redirection works end-to-end.
- Non-functional:
  - Maintain design system standards.
  - Zero accessibility regressions.

## Existing Patterns & Reuse

- `BrandLogo` component is the standard for logo display.
- `asChild` prop in Shadcn UI components is the standard for composition.

## External Resources

- Shadcn UI Button composition docs.

## Constraints & Risks

- Changing `icon.svg` might affect social previews or browser tabs.
- Redirection logic must not cause infinite loops.

## Open Questions

- Are there any hardcoded SVG paths in legacy components?

## Recommended Direction

1. Apply `asChild` to `Button` components inside `Link`.
2. Update `BrandIcon.tsx` with the unified path and update `src/app/icon.svg`.
3. Verify `ImplicitAuthHandler.tsx`.
