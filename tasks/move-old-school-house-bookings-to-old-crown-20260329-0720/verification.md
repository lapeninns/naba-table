---
task: move-old-school-house-bookings-to-old-crown
timestamp_utc: 2026-03-29T07:20:00Z
owner: github:@openai
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

- Not applicable; no UI change.

## Test Outcomes

- [x] Source and destination restaurant records verified
- [x] Preflight counts recorded
- [x] Update executed successfully
- [x] Postflight counts recorded

## Findings

- Preflight (`artifacts/preflight.txt`) confirmed:
  - Old School House had 1 booking.
  - Old Crown had 674 bookings.
  - Booking `2fd69938-1e03-48c3-a776-34fa4bd3ab36` / ref `LYAGFXAT3Y` had:
    - 1 table assignment
    - 1 assignment idempotency row
    - 1 confirmation cache row
    - 1 allocation row
    - 1 analytics event row
- Execution (`artifacts/execution.txt`) completed with:
  - `unassign_tables_atomic` path succeeding
  - 1 confirmation cache row deleted
  - 1 assignment idempotency row deleted
  - booking/customer venue IDs updated from Old School House to Old Crown
- Postflight (`artifacts/postflight.txt`) confirmed:
  - Old School House booking count is now 0.
  - Old Crown booking count is now 675.
  - Booking `2fd69938-1e03-48c3-a776-34fa4bd3ab36` now belongs to Old Crown.
  - The linked customer `c120ec30-295b-4f63-bdca-c8cbaebbcece` now belongs to Old Crown.
  - No remaining table assignments, assignment idempotency rows, confirmation cache rows, or allocations remain for the moved booking.
  - The booking analytics event now points at Old Crown.

## Artifacts

- Preflight: `artifacts/preflight.txt`
- Execution: `artifacts/execution.txt`
- Postflight: `artifacts/postflight.txt`

## Rollback Notes

- If this move needs to be reversed, use the captured IDs from `artifacts/preflight.txt` / `artifacts/execution.txt`:
  - Booking `2fd69938-1e03-48c3-a776-34fa4bd3ab36`
  - Customer `c120ec30-295b-4f63-bdca-c8cbaebbcece`
- Minimum rollback:
  - Set `bookings.restaurant_id` back to `a120da71-ba6d-446f-a33a-2e78787abcb0`
  - Set `customers.restaurant_id` back to `a120da71-ba6d-446f-a33a-2e78787abcb0`
  - Set `analytics_events.restaurant_id` back to `a120da71-ba6d-446f-a33a-2e78787abcb0` for the moved booking
- Assignment state was intentionally cleared during the move. If a rollback is required, table/zone state should be rebuilt from live capacity rules rather than blindly restoring the stale Old School House assignment captured in preflight.

## Known Issues

- Direct Postgres auth via `.env.vercel-production` failed in this workspace (`password authentication failed for user "postgres"`), but the service-role Supabase path was sufficient for the move and verification.

## Sign-off

- [x] Engineering
