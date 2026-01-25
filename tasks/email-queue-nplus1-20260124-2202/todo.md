---
task: email-queue-nplus1
timestamp_utc: 2026-01-24T22:02:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Core

- [x] Update cron route to use `getJobCounts` and `getJobs` for waiting/delayed jobs
- [x] Preserve ready-job filtering and response payloads

## Verification

- [ ] Run LSP diagnostics on `src/app/api/cron/process-emails/route.ts`

## Notes

- Assumptions: No behavior change beyond job fetching.
- Deviations: LSP diagnostics unavailable (typescript-language-server not installed).

## Batched Questions

- None.
