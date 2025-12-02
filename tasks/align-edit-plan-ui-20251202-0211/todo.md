---
task: align-edit-plan-ui
timestamp_utc: 2025-12-02T02:11:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm AGENTS stack (root + src/components) and follow reuse guidance.

## Core

- [x] Add plan-style variant option to `ScheduleAwareTimestampPicker` (copy + layout toggle).
- [x] Switch `EditBookingDialog` to use the plan variant with accordion layout.
- [x] Ensure summary and headings match plan step language (“Time options”, “Time: …”).

## Tests

- [ ] Manual sanity check locally (dialog renders, select date/time/party size, notes intact). Note if not run.

## Notes

- Assumptions: create flow continues using default variant; only edit dialog switches.
- Deviations: None yet.
