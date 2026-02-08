---
task: db-hardening-staging
timestamp_utc: 2026-02-07T14:39:30Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Implementation Checklist

## Prep

- [x] Snapshot current staging RLS/grants, indexes, FK-index coverage.
- [x] Create new migrations for:
  - [x] RLS hardening / privilege tightening
  - [x] Loyalty removal
  - [x] FK index additions + index dedupe
- [x] Ensure Supabase CLI migration versions are unique (no duplicate version prefixes).

## Apply (Staging)

- [x] Apply migrations to staging DB.
- [x] Capture outputs + before/after artifacts.
- [x] Repair staging migration history table so `supabase db push` is safe (no re-apply).

## App Code

- [x] Remove loyalty stubs and all references (tier/points + VIP endpoint/hook).
- [x] Update Supabase generated types from staging.
- [ ] Run tests and typecheck (repo currently not typecheck-clean; see verification notes).

## Verification

- [x] Confirm no risky `TO public` allow-all policies remain.
- [x] Confirm loyalty tables removed.
- [x] Confirm FK missing index report is empty.
