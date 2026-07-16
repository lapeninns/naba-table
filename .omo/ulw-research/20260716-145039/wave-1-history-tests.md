# Wave 1: tests and history

## Key findings

- October 2025 implemented `close - max(buffer, duration)`.
- March 2026 deliberately removed duration/buffer pruning and locked start-slot authority in tests.
- May 2026 restored end-before-close only in unified validation for security/data-integrity; June hard-enabled it.
- Both sides remain intentional and test-backed, producing the live mismatch.

## Primary anchors

- Commits `922dd6ce`, `21502d2b` / `ab301ac2`, `6abe47a6`, `d735f546`
- `tests/server/bookings/timeValidation.test.ts:57-65`
- `tests/server/booking-validation-security.test.ts:149-160`
- `tests/server/restaurants/schedule.test.ts:64-110`

## EXPAND

- LEAD: Decide the authoritative product rule: configured-start authority, finish-by-operating-close, or a hybrid `close - max(buffer,resolvedDuration)`. — WHY: repository history intentionally supports both sides; code cannot resolve the product choice. — ANGLE: product/operator decision plus industry-practice evidence.
- LEAD: Verify disabled-tail manual input behavior by execution. — WHY: latest-slot helper includes disabled slots and lacks a regression. — ANGLE: picker hook/component test with final schedule slot disabled.
- LEAD: Add an executable overnight unified-create test. — WHY: static evidence strongly predicts rejection, but no route-level test currently demonstrates the failure. — ANGLE: close `00:00` and `02:00`, zoned next-day boundaries.
- DEAD END: No additional commit messages mentioning late seating, closing cutoff, or overruns beyond the catalogued commits.
- DEAD END: No current test consumes last-seating buffer as a slot/create invariant.
- DEAD END: Archived task and remote verification artifacts for the Oct and Mar policy decisions were fully inspected.
