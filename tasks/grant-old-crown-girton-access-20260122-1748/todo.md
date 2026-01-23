---
task: grant-old-crown-girton-access
timestamp_utc: 2026-01-22T17:48:45Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm target project ref is pre-staging: `loxrwkeuxesctnrdpksy`.
- [x] Locate user id for oldcrown@lapeninns.com.
- [x] Locate restaurant id for Old Crown Girton.

## Core

- [x] Update membership role to `owner` for Old Crown Girton.
- [x] Confirm no other memberships for this user.

## Verification

- [x] Query memberships to confirm only Old Crown Girton remains.
- [x] Record outputs in `verification.md`.

## Notes

- Assumptions:
  - Supabase Management API used for queries because MCP target did not switch in-session.
- Deviations:
  - None.

## Batched Questions

- None.
