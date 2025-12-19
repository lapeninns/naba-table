---
task: booking-idempotency-checksum
timestamp_utc: 2025-12-07T20:41:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Booking idempotency payload checksum column missing (staging)

## Requirements

- Fix staging inline/auto assignment flow error: `column "payload_checksum" of relation "booking_assignment_idempotency" does not exist` when calling `confirm_hold_assignment_tx`.
- Keep allocator flows functional; avoid production impact.

## Existing Patterns & Reuse

- Code in `server/capacity/table-assignment/assignment.ts` updates `booking_assignment_idempotency.payload_checksum` when syncing assignments.
- Supabase types already include `payload_checksum` (see `types/supabase.ts`).
- Staging schema snapshot (`tasks/db-perf-optimization-20251207-0620/artifacts/schema-before.sql`) shows column absent.

## Constraints & Risks

- Supabase remote-only; change must be safe and quick (hotfix).
- Minimal write lock; ALTER ADD COLUMN should be metadata-only.
- Backfill optional; future writes populate via code.

## Open Questions

- None; scope limited to staging hotfix.

## Recommended Direction

- Add nullable `payload_checksum text` column to `public.booking_assignment_idempotency` in staging.
- Verify column exists after change; no code change needed.
