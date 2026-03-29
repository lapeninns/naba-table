---
task: operating-hours-override-calendar
timestamp_utc: 2026-03-29T17:28:38Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Operating Hours Override Calendar

## Objective

We will align the operating-hours override date control with the app’s shared calendar picker so restaurant operators get a consistent interaction model across booking and settings surfaces.

## Success Criteria

- [ ] Override rows no longer use the browser-native `type="date"` control.
- [ ] Override rows use the shared `Calendar` component via a popover trigger.
- [ ] Existing date value shape, validation, and save payload stay unchanged.
- [ ] Keyboard/focus behavior remains accessible.

## Architecture & Components

- `OperatingHoursSection`: continue owning override row state and validation.
- `OperatingHoursOverrideDateField`:
  - small feature-local component for rendering the override date trigger, popover, and calendar
  - accepts current string value, change handler, error state, and disabled state

## Data Flow & API Contracts

- No API contract changes.
- State remains `effectiveDate: string` in `YYYY-MM-DD` format.
- Calendar selection converts the chosen `Date` back to `YYYY-MM-DD` before updating the row state.

## UI/UX States

- Empty date: show placeholder text in the trigger.
- Selected date: show formatted human-readable label.
- Error: preserve inline error messaging and destructive border state.
- Disabled: trigger remains non-interactive while saving.

## Edge Cases

- Invalid or empty existing string should fall back to placeholder label without crashing.
- Clearing is not required; new overrides still default to today.
- Duplicate-date validation remains unchanged and still keys off the stored string.

## Testing Strategy

- Focused lint/type-safe implementation.
- Manual browser verification on the dev harness route.
- Confirm console stays clean and the calendar opens/selects/closes correctly.

## Rollout

- No feature flag needed.
- Ship in the existing restaurant settings codepath.
- Regression surface limited to override date selection in operating hours.
