---
task: booking-dialog-hooks-warning
timestamp_utc: 2025-12-01T18:06:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Identify lint warning source in `BookingDetailsDialogWrapper.tsx`.

## Core

- [x] Derive a `startIso` value outside the summary `useMemo`.
- [x] Add `startIso` to the summary memo dependencies (and remove unused ones if applicable).

## Verification

- [x] Run targeted ESLint on the modified file to confirm zero warnings.
- [x] Update verification notes.

## Notes

- Assumptions: Change is non-UI; no manual UI QA planned unless dialog behavior appears affected.
- Deviations: None yet.
