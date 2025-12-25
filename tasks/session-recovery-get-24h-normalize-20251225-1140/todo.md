---
task: session-recovery-get-24h-normalize
timestamp_utc: 2025-12-25T11:40:47Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Discovery

- [x] Locate “session recovery notes” and extract required env vars, event names, and metadata schema (no dedicated notes doc found; followed existing `guest_lookup.*` conventions)
- [x] Locate session recovery GET handler (route path + file)
- [x] Locate `zonedDateTimeToUtc` and `assertBookingNotInPast`

## Session Recovery GET

- [x] Wire in HMAC access token helper(s)
- [x] Read env vars via existing env module/pattern
- [x] Emit observability events per notes (no tokens/PII in logs)
- [x] Return/attach access metadata per notes

## Date/Time Normalization

- [x] Normalize `24:xx:xx` → next day `00:xx:xx`
- [x] Add regression tests for conversion + booking validation

## Verification

- [x] Run unit tests for affected packages/apps (targeted vitest runs)
- [x] Update `verification.md` with evidence and any known issues
