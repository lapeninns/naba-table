---
name: simple_categories_editor
overview: Redesign the Categories rows in the Business Context advanced section to feel operator-friendly by simplifying layout and replacing raw JSON editing with guided inputs while preserving current save APIs.
todos:
  - id: refactor-category-row-layout
    content: Simplify category row visual hierarchy and header actions in RestaurantBusinessContextSection.tsx
    status: pending
  - id: rewrite-category-field-language
    content: Replace internal-feeling category labels/help text with operator-facing copy
    status: pending
  - id: guided-more-hours-input
    content: Replace moreHoursTypes JSON textarea with chip-based guided input while preserving payload format
    status: pending
  - id: verify-regression-safety
    content: Run lint and targeted tests; verify category add/edit/remove/save on ops route
    status: pending
isProject: false
---

# Simplify Categories Editor UX

## Objective

Make the Categories panel on the ops Restaurant Profile feel like a product form (not an internal tool) by clarifying labels, reducing visual noise, and replacing JSON text editing with structured controls.

## Target Files

- [/Users/amankumarshrestha/LapenInns Project/nabatableLP/src/components/features/restaurant-settings/RestaurantBusinessContextSection.tsx](/Users/amankumarshrestha/LapenInns Project/nabatableLP/src/components/features/restaurant-settings/RestaurantBusinessContextSection.tsx)
- [/Users/amankumarshrestha/LapenInns Project/nabatableLP/tests/components/GoogleBusinessProfileSection.test.tsx](/Users/amankumarshrestha/LapenInns Project/nabatableLP/tests/components/GoogleBusinessProfileSection.test.tsx) (if any copy/interaction assertions overlap)

## Planned Changes

- **Restructure each category row for readability**
  - Keep one clean card per category but reduce “box-in-box” density via spacing and hierarchy updates.
  - Move destructive action (`Remove`) to an icon-only or subdued affordance in the row header.
  - Replace generic title (`Category N`) with meaningful fallback (`Primary category` or entered display name).

- **Use operator-facing labels and help text**
  - Rename `Category code` to a plain-language label (e.g., `Google category code`) with concise helper text.
  - Keep `Primary category` as a simple toggle but add one-line explanation of impact.

- **Replace `Supported more-hours types JSON` with guided inputs**
  - Introduce a token/chip-style input (comma-enter behavior) for more-hours types.
  - Store chips in component state and serialize back to array when saving.
  - Keep internal validation equivalent to current behavior by mapping guided values to the same payload shape.

- **Preserve existing data contracts and save flow**
  - Continue using existing `categories` editor state and `saveFamily('categories')` pipeline.
  - Update `toCategoryEditors` and submit mapping logic only as needed to support guided values without changing API contracts.

## Validation

- Run `pnpm run lint` for changed files.
- Run focused tests for affected UI behavior.
- Manually verify on the shipped ops route (`/app/settings/restaurant/...`) that categories are easier to scan/edit and save behavior is unchanged.
