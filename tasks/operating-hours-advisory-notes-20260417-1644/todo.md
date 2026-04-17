---
task: operating-hours-advisory-notes
timestamp_utc: 2026-04-17T16:44:42Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Identify the canonical reserve advisory path and its backing schedule API.
- [x] Confirm operating-hours notes already exist on the backend data model.

## Core

- [x] Add effective operating-hours notes to the public restaurant schedule payload.
- [x] Normalize notes in the reserve schedule client.
- [x] Update plan-step advisory derivation to prefer notes when present.

## UI/UX

- [x] Preserve existing alert semantics and fallback advisory behavior.

## Tests

- [x] Update advisory unit tests.
- [x] Update schedule normalization unit tests.
- [x] Run focused automated tests.
- [x] Complete browser verification and record the proof path.

## Notes

- Assumptions:
  - The desired behavior is to show the selected date's operating-hours note whenever present, even on weekdays.
  - The current generic advisory should remain as the fallback for weekend/override dates without a note.
- Deviations:
  - Verification-first review of the existing production path was used before adding tests because the task changes established behavior rather than adding a net-new flow.
  - The existing dev harness was extended to include an operating-hours-note scenario so Chrome DevTools proof could exercise the new behavior without relying on seeded backend note data.

## Batched Questions

- None.
