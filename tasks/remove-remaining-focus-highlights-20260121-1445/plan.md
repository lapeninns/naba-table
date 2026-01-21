# Implementation Plan: Remove Remaining Focus Highlights

## Objective

Remove the specific focus-visible ring classes and CSS border-color focus changes identified in `components/ui/button.tsx` and `styles/guest-design-system.css` to achieve a completely focus-ring-free UI as requested.

## Success Criteria

- [ ] `components/ui/button.tsx`: `destructive` variant has no focus-visible ring classes.
- [ ] `styles/guest-design-system.css`: `.guest-theme .input-base:focus` does not change `border-color`.
- [ ] Build succeeds.

## Architecture & Components

- **Button**: Update `cva` configuration.
- **Guest CSS**: Update CSS rules.

## Implementation Steps

1.  **Modify `components/ui/button.tsx`**:
    - Locate `destructive` variant.
    - Remove `focus-visible:ring-destructive/20` and `dark:focus-visible:ring-destructive/40`.
2.  **Modify `styles/guest-design-system.css`**:
    - Locate `.guest-theme .input-base:focus`.
    - Remove `border-color: hsl(var(--ring));`.
    - Keep `outline: none;` to prevent browser default ring.
3.  **Verification**:
    - Re-read files to confirm removal.
    - Run `lsp_diagnostics` (if available/useful) to check for syntax errors.

## Risks

- **Browser Defaults**: Removing `outline: none` would bring back native focus rings. I will ensure `outline: none` remains where appropriate.
