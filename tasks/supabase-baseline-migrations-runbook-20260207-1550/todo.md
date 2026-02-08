---
task: supabase-baseline-migrations-runbook
timestamp_utc: 2026-02-07T15:50:18Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Docs

- [x] Add runbook doc under `docs/db/`.
- [x] Document staging workflow (prod clone → baseline → apply deltas).
- [x] Document production workflow (baseline once → forward-only migrations).
- [x] Include safeguards and failure recovery.

## Scripts

- [x] Add unique migration version check script.
- [x] Add migration repair/baseline script with `--through` and `--dry-run`.
- [x] Ensure scripts are deterministic and non-interactive.

## Verification

- [x] Run scripts against linked staging project.
- [x] Confirm `supabase db push --linked --dry-run` is clean after baseline.
- [x] Update `verification.md` with commands and outcomes.
