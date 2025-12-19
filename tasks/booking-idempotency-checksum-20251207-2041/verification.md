---
task: booking-idempotency-checksum
timestamp_utc: 2025-12-07T20:41:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Manual QA

- Pending: rerun inline/auto assignment on staging to confirm no missing-column error (after DB change applied).

## DB Verification

- Blocked: outbound to Supabase Postgres (hosts tried: db.mqtchcaavsucsdjskptc.supabase.co, mqtchcaavsucsdjskptc.supabase.co on 5432/6543) hangs; likely egress restriction or IPv6-only. Could not capture pre/post schema. SQL to apply is in `artifacts/add_payload_checksum.sql`.

## Tests

- Ran `pnpm test -- --runInBand --passWithNoTests` (vitest): 20 files, 91 tests passed. (Note: DB change already applied manually.)

## Known Issues

- Missing column persists until SQL is applied from an IPv6-capable environment or Supabase Studio.
