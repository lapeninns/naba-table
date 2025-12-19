---
task: lint-cleanup
timestamp_utc: 2025-12-05T23:44:49Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm target file and warnings list

## Core

- [x] Remove unused imports/variables in `ScheduleAwareTimestampPicker`
- [x] Remove unused imports/watchers in `DetailsStep`
- [x] Remove unused variable in `PlanStepForm`
- [x] Fix dynamic icon lint error and import order in `WizardNavigation`

## Tests

- [x] Run `pnpm eslint` on touched files with `--max-warnings=0`

## Notes

- Assumptions: Only reported warnings need fixing; behavior must stay the same.
- Deviations: None yet.
