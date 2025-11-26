---
task: zones-migration-seed
timestamp_utc: 2025-11-26T00:15:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm target remote project via Supabase CLI context.
- [x] Review pending migrations under `supabase/migrations/`.

## Core

- [x] Apply pending migrations remotely (`supabase db push`).
- [x] Execute seed for updated zones/tables (identify correct command/file).

## Verification

- [x] Capture CLI outputs into `tasks/zones-migration-seed-20251126-0015/artifacts/`.
- [x] Update `verification.md` with results and rollback notes.

## Notes

- Assumptions: remote environment already authenticated via Supabase CLI.
- Deviations: None yet.

## Batched Questions

- Which seed file/command is authoritative for zones data?
