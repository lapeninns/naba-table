---
task: booking-idempotency-checksum
timestamp_utc: 2025-12-07T20:41:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Create task folder and docs
- [ ] Capture pre-change schema (blocked: staging DB is IPv6-only; current host not reachable from this environment)

## Core

- [ ] Add `payload_checksum` column (staging) (blocked: TCP 5432/6543 to supabase host hangs; likely egress blocked or IPv6-only. Tried hosts: db.$PROJECT_URL.supabase.co, $PROJECT_URL.supabase.co on 5432/6543; no connection.)
- [ ] Capture post-change schema

## Verification

- [ ] Note manual check results in verification.md

## Notes

- Hotfix: minimal scope; no code changes.
