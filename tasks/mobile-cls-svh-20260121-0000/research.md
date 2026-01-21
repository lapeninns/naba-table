# Research: Mobile CLS Reduction

## Requirements

- Functional: Reduce CLS on mobile by using `svh` units.
- Non-functional: Minimal patches, no visual changes, maintain `min-h-screen` fallback.

## Existing Patterns & Reuse

- Layouts use `min-h-screen`.

## External Resources

- None.

## Constraints & Risks

- Must not break layout on browsers not supporting `svh` (fallback handles this).

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Add `min-h-[100svh]` to layout wrappers.
