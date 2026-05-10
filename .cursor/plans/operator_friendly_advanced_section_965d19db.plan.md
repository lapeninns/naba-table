---
name: operator_friendly_advanced_section
overview: Rewrite the Restaurant Profile Advanced area to use operator-friendly language and clearer information hierarchy while keeping current functionality intact.
todos:
  - id: rewrite-advanced-wrapper-copy
    content: Update `profile-advanced` card/accordion copy in `RestaurantProfileSection.tsx` to user-facing language
    status: pending
  - id: rewrite-business-context-copy
    content: Replace internal jargon in `RestaurantBusinessContextSection.tsx` descriptions, alerts, and posture messages
    status: pending
  - id: verify-no-regressions
    content: Lint changed files and verify behavior on ops route
    status: pending
isProject: false
---

# Make Advanced Section Operator-Friendly

## Goal

Replace internal-facing copy and framing in the profile `Advanced` area with clear operator language, while preserving the existing Business Context editing workflow.

## Scope

- Update the wrapper section in [src/components/features/restaurant-settings/RestaurantProfileSection.tsx](/Users/amankumarshrestha/LapenInns Project/nabatableLP/src/components/features/restaurant-settings/RestaurantProfileSection.tsx) (`profile-advanced` block).
- Update internal labels/help text in [src/components/features/restaurant-settings/RestaurantBusinessContextSection.tsx](/Users/amankumarshrestha/LapenInns Project/nabatableLP/src/components/features/restaurant-settings/RestaurantBusinessContextSection.tsx).
- Keep data flow, save behavior, tabs, and API contracts unchanged.

## Planned Changes

- In `RestaurantProfileSection`:
  - Rename section title from `Advanced` to a user-facing label (e.g., `Profile discovery settings`).
  - Replace description text with outcome-focused wording (what operators can do and why it matters).
  - Remove internal taxonomy cues in the accordion header (e.g., `Advanced` badge) and make the trigger text plain-language.

- In `RestaurantBusinessContextSection`:
  - Rewrite section-level descriptions and state copy (`loading`, `error`, `empty`, default view) to operator-friendly wording.
  - Rewrite the informational alert to explain the relationship with Google in plain terms (editable here vs reference view on GBP page), without internal jargon like “canonical tables”, “verification-only”, or “core-owned CRUD”.
  - Reword `SYNC_POSTURE` and seeding messages so operators understand practical behavior (where edits are saved, when imported data appears, and when they should review on GBP page).
  - Keep technical field labels as-is where they map to required domain concepts, but simplify surrounding instructional copy.

## Validation

- Run lint for changed files and resolve any introduced issues.
- Manually verify on the shipped ops route that:
  - the section reads as operator-facing,
  - no functional regressions in tab switching/saving,
  - accordion behavior remains intact.

## Notes

- This is a copy/UX clarity pass only; no schema, endpoint, or mutation behavior changes.
