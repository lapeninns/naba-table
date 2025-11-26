---
task: unify-max-width
timestamp_utc: 2025-11-26T16:49:00Z
owner: github:@amankumarshrestha
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Unify page max width to 80vw

## Objective

Make all top-level page shells and layout wrappers use `max-w-[80vw]` for consistent width.

## Success Criteria

- All identified shells/layout wrappers use `max-w-[80vw]`.
- No stray 5xl/6xl/4xl wrappers remain for page containers.

## Architecture & Components

- Update shared shells: `PageSection`, `PageHero`, `PageShell`, and feature shells to `max-w-[80vw]`.
- Adjust wizard and booking shells to `max-w-[80vw]` while keeping responsive behavior.

## Data Flow & API Contracts

- None.

## UI/UX States

- Ensure padding remains for small screens; widths capped at ~80% viewport for large screens.

## Edge Cases

- Large wizards and dialogs: ensure overflow handling unchanged.

## Testing Strategy

- Visual spot-check key routes (marketing, owner landing, guest dashboard, reservation wizard) in browser later.

## Rollout

- Direct change; no flags.

## DB Change Plan

- Not applicable.
