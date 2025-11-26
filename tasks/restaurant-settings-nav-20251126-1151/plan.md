---
task: restaurant-settings-nav
timestamp_utc: 2025-11-26T11:51:47Z
owner: github:@amankumarshrestha
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Restaurant Settings Navigation

## Objective

Add a "Tables" quick link card to the Restaurant settings landing section, reorder the cards by importance, and surface the same card navigation on the Tables settings page.

## Success Criteria

- [ ] "Tables" appears alongside the existing Restaurant settings cards.
- [ ] Cards are displayed in the new priority order.
- [ ] Tables page shows the same card navigation for consistency.
- [ ] Links navigate to the correct routes with consistent styling and accessibility.

## Architecture & Components

- Update the configuration array in `src/components/features/restaurant-settings/routes.ts` that drives the settings navigation cards.
- Ensure the card list render uses that array order.
- Render the same card navigation component on `src/app/app/(app)/settings/tables/page.tsx`.

## Data Flow & API Contracts

- Static configuration only; no API changes.

## UI/UX States

- Default render only; no loading/error states involved.

## Edge Cases

- Route path for Tables must match existing tables page path; ensure slug/route exists.

## Testing Strategy

- Visual check of the settings landing page for new card and ordering.
- Accessibility quick check: tab order follows new ordering; card labels/descriptions remain readable.

## Rollout

- No flags; change is safe and static.

## DB Change Plan (if applicable)

- Not applicable.
