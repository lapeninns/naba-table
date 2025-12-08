---
task: fix-linting-errors
timestamp_utc: 2025-12-08T00:36:08Z
owner: github:@amanshresthaa
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Research: Fix Linting Errors

## Requirements

The user cannot commit due to eslint errors and warnings. The `max-warnings=0` setting means even warnings block the commit.

## Issues Identified

1.  **BookingConfirmationActions.tsx**:
    - Unused imports: `ExternalLinkIcon`, `CheckIcon`.
    - Unused state: `copied`, `setCopied`.

2.  **ConfirmationStep.tsx**:
    - Unused variables: `handleClose`, `statusTone`.

3.  **DetailsStep.tsx**:
    - Unused variable: `description`.

4.  **ReviewStep.tsx**:
    - Unused import: `Badge`.
    - Unescaped entities: `"` in `"{details.notes}"`.

## Plan

1.  Remove unused imports and variables in all affected files.
2.  Fix unescaped entities in `ReviewStep.tsx` by using `&quot;` or removing the manual quotes if handled by CSS/design intent (or just escaping them).

## Files to Edit

- `reserve/features/reservations/wizard/ui/BookingConfirmationActions.tsx`
- `reserve/features/reservations/wizard/ui/steps/ConfirmationStep.tsx`
- `reserve/features/reservations/wizard/ui/steps/DetailsStep.tsx`
- `reserve/features/reservations/wizard/ui/steps/ReviewStep.tsx`
