---
task: restaurant-settings-consistency
timestamp_utc: 2025-11-26T12:34:10Z
owner: github:@amankumarshrestha
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Restaurant Settings Consistency

## Objective

Make all restaurant settings pages, including Tables, share the same page shell so spacing, max-width, headings, and sub-navigation look seamless.

## Success Criteria

- [ ] Tables page uses the same max-width container and header structure as other restaurant settings views.
- [ ] Subnav alignment and typography match across profile, operating hours, service periods, occasions, and tables.
- [ ] No regression to auth gating or data flows; routes remain accessible at their current paths.

## Architecture & Components

- **RestaurantSettingsPageShell (new)**: shared wrapper that applies the `max-w-5xl` centered layout, eyebrow/title/description block, renders the `RestaurantSettingsSubnav`, and wraps children.
- **Restaurant layout** (`src/app/app/(app)/settings/restaurant/layout.tsx`): replace inline container with `RestaurantSettingsPageShell` for reuse.
- **Tables page** (`src/app/app/(app)/settings/tables/page.tsx`): swap existing container for `RestaurantSettingsPageShell`, passing a Tables-specific title/description while keeping Suspense + `TableInventoryClient` intact.

## Data Flow & API Contracts

- No API/contract changes. Shell is presentation-only; existing hooks/services remain untouched.

## UI/UX States

- Loading: keep existing Suspense fallback for tables.
- Error/empty: unchanged in `OpsRestaurantSettingsClient` and `TableInventoryClient`.

## Edge Cases

- Active nav state should still highlight Tables via pathname matching.
- Auth redirect should behave the same for tables and restaurant pages.

## Testing Strategy

- Manual UI check in browser: verify spacing/max-width and subnav alignment on at least Profile and Tables pages (desktop + narrow width).
- Spot-check keyboard focus on subnav links.

## Rollout

- No flags needed; direct replacement.
- Monitor for layout regressions visually.

## DB Change Plan

- Not applicable (no DB changes).
