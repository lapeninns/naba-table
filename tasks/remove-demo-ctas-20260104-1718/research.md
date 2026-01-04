# Research: Remove Demo CTAs

## Requirements

- Functional: Remove "Book a Demo", "Schedule Demo", or similar CTAs from the landing page.
- Non-functional: Maintain layout stability.

## Existing Patterns & Reuse

- Landing page components are in `src/components/landing`.
- Likely using `Button` or `CTA` components.

## External Resources

- None.

## Constraints & Risks

- Removing buttons might leave empty spaces in layout (e.g., Hero section).
- Need to check if they should be replaced by "Sign Up" or just removed.

## Open Questions (owner, due)

- Q: Should we replace "Book a Demo" with another action (e.g., "Get Started")?
  A: User said "remove all CTA of demo", implying removal. If a primary CTA is needed, "Get Started" / "Sign Up" is usually the alternative, but I will stick to removal or hiding first unless it breaks design.

## Recommended Direction (with rationale)

- Search for "Demo" string in `src/components/landing`.
- Identify components.
- Remove the buttons.
