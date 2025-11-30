---
task: edit-calendar-fetch
timestamp_utc: 2025-11-30T16:34:57Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Create task folder and templates
- [x] Identify all calendar fetch logic in `ScheduleAwareTimestampPicker`

## Core

- [x] Add calendar mask prefetch and unavailable-date tracking (mirror create flow)
- [x] Remove month-wide per-day schedule prefetch; keep active-date schedule loading
- [x] Update disabled-date and messaging logic to rely on mask + active schedule

## UI/UX

- [ ] Ensure closed dates disable correctly; unknown dates remain selectable
- [ ] Confirm time grid still loads and error messages show appropriately

## Tests / Verification

- [x] Run `pnpm lint` (if feasible)
- [ ] Manual QA via Chrome DevTools MCP on edit booking dialog (calendar + time selection)

## Notes

- Lint completed; existing warnings surfaced in unrelated lib/server scripts.
