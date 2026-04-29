---
name: Sticky review bar behavior
overview: Update the Google Business Profile sync page so the bottom Review & Apply summary bar appears only after at least one actionable selection exists, and remains sticky when visible.
todos:
  - id: inspect-footer-guard
    content: Update footer render condition to require selected changes
    status: pending
  - id: preserve-sticky-style
    content: Keep sticky layout/styling unchanged when the footer is visible
    status: pending
  - id: verify-selection-transitions
    content: Confirm show/hide transitions for select and clear flows
    status: pending
isProject: false
---

# Implement Conditional Sticky Review Bar

## Goal

Make the bottom `Review & Apply` summary CTA less noisy by showing it only when there are selected imports/exports, while preserving sticky behavior once shown.

## Scope

- Update rendering logic in [`/Users/amankumarshrestha/LapenInns Project/nabatableLP/src/components/features/restaurant-settings/google-business-profile/components/GoogleBusinessProfileSyncPageShell.tsx`](/Users/amankumarshrestha/LapenInns%20Project/nabatableLP/src/components/features/restaurant-settings/google-business-profile/components/GoogleBusinessProfileSyncPageShell.tsx).
- Reuse existing computed state (`hasSelectedChanges`) to drive visibility.

## Changes

1. Keep `hasSelectedChanges` as the single source of truth for selection state.
2. Replace the current `draft ? (...) : null` footer condition with `draft && hasSelectedChanges ? (...) : null` so the bar only renders when selections exist.
3. Keep the sticky container classes unchanged for the visible state, ensuring it still pins near the bottom while scrolling.
4. Verify the button disabled logic still behaves correctly (it may become redundant once hidden, but no behavioral regression should be introduced).

## Validation

- On the Google Business Profile sync page, confirm:
  - No imports/exports selected: summary CTA bar is not rendered.
  - At least one import/export selected: summary CTA bar appears and remains sticky near page bottom.
  - Clearing all selections hides the bar again.

## Notes

This is a targeted UI behavior change with no API/data-shape impact and no cross-file dependency expected.
