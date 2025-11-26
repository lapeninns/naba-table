---
task: layout-consistency
timestamp_utc: 2025-11-26T14:02:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Layout width consistency & teams link placement

## Requirements

- Identify layout container widths (`max-w-*`) across relevant app pages/sections; confirm consistency.
- Move the Teams entry under restaurant settings navigation.

## Existing Patterns & Reuse

- Settings pages live under `src/app/app/(app)/settings` with feature components in `src/components/features/restaurant-settings/*`.
- Navigation for settings appears in `src/components/features/restaurant-settings/` (to confirm exact file during planning).

## External Resources

- None.

## Constraints & Risks

- Must adhere to existing design system and avoid regressions across settings sections.
- Navigation change should not break deep links or routing.

## Open Questions (owner, due)

- Do other pages outside settings also need width alignment? (Assess during inventory.)

## Recommended Direction (with rationale)

- Inventory widths in settings pages/components; standardize on the dominant token (likely `max-w-5xl` or `max-w-6xl`) to reduce inconsistency.
- Update nav grouping so Teams appears under Restaurant Settings.
