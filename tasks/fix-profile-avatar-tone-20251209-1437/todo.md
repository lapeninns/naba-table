---
task: fix-profile-avatar-tone
timestamp_utc: 2025-12-09T14:37:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm `GuestStatus` supported tones and current usage in profile form.

## Core

- [x] Update avatar error `GuestStatus` to use supported `tone` literal.
- [x] Allow `GuestStatus` to forward refs and `GuestCard` to accept `style` for existing usages.

## UI/UX

- [x] Ensure avatar error message still renders with danger/error styling when present.

## Tests

- [x] Run `pnpm run build` (covers typecheck) to confirm error resolved.

## Notes

- Assumptions: Changing tone from `error` to `danger` preserves intended styling.
- Deviations: Manual UI QA not planned because UI rendering should remain unchanged; document in verification.

## Batched Questions

- None.
