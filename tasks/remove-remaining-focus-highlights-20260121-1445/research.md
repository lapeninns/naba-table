# Research: Remove Remaining Focus Highlights

## Requirements

- **Functional**:
  - Remove specific `focus-visible` ring classes from `components/ui/button.tsx` (destructive variant).
  - Remove `.guest-theme .input-base:focus` styling (border-color change) from `styles/guest-design-system.css`.
  - Ensure no other focus highlights remain in these files.
- **Non-functional**:
  - Maintain build integrity.
  - Do not add new styles.
  - Simplify/clean up code.

## Existing Patterns & Reuse

- **Button Variants**: The `destructive` variant has specific focus rings that were likely missed in a global replace or were specific overrides.
- **Guest Theme**: The `input-base` has a manual CSS focus state that changes `border-color`.

## Constraints & Risks

- **Accessibility**: Removing focus indicators reduces accessibility. The user has explicitly requested this despite the impact.
- **Build**: Ensure removing these styles doesn't break any syntax (e.g., trailing commas or invalid CSS).

## Recommended Direction

- **Edit `components/ui/button.tsx`**: Remove `focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40` from the `destructive` string.
- **Edit `styles/guest-design-system.css`**: Remove the `.guest-theme .input-base:focus` block entirely or just the property. Since `outline: none` is usually desired when removing rings, I might keep `outline: none` but remove `border-color`. However, the prompt says "Remove ... styling entirely or remove border-color change". I will remove the `border-color` change. If I remove the whole block, it might revert to default browser focus behavior (which is usually an outline), unless handled elsewhere. The `input-base` class (line 63) has `border: 1px solid...`. If I remove the `:focus` rule, it will stay 1px solid input color. If I remove `outline: none`, the browser default outline might show up.
- **Decision**: The user said "Remove remaining focus highlight styles". If I remove `outline: none`, the browser default returns. So I should probably _keep_ `outline: none` but remove `border-color`. Or, if the goal is "no styles", maybe `outline: none` is already applied globally?
- Checking `components/ui/button.tsx` line 8: it has `outline-none`.
- Checking `styles/guest-design-system.css` line 71: it has `outline: none`.
- If I delete the whole block `.guest-theme .input-base:focus`, and if there is no other rule, the browser default focus ring might appear.
- **Refinement**: The user said "remove border-color change" as an option. I will keep `.guest-theme .input-base:focus { outline: none; }` to ensure no native ring appears, but remove the `border-color` line.

## Plan

1. Edit `components/ui/button.tsx`.
2. Edit `styles/guest-design-system.css`.
3. Verify.
