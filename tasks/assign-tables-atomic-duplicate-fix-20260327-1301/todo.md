---
task: assign-tables-atomic-duplicate-fix
timestamp_utc: 2026-03-27T13:01:00Z
owner: github:@amankumarshrestha
reviewers: [github:@amankumarshrestha]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

- [x] Trace the production error to the automated confirm path and legacy atomic RPC fallback.
- [x] Confirm the correct fix boundary is automated retry logic, not manual confirm.
- [x] Patch conflict retry handling in `confirmWithPolicyRetry`.
- [x] Add unit tests for conflict recovery.
- [x] Run targeted tests.
- [x] Record results in `verification.md`.
