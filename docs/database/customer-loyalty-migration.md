# Customer & Loyalty Migration Guide

Sprint 3 introduces first-class `customers`, `customer_profiles`, `loyalty_programs`, and analytics-backed loyalty ledgers. This guide covers validation and rerun steps for the migration set (`005_customers_profiles.sql`, `006_loyalty_programs.sql`, `007_analytics_events.sql`).

## Post-deploy checklist
- [ ] Run `scripts/db/backfill-customers-loyalty.sql` against staging after applying migrations. It is idempotent and replays the backfill logic with additional safeguards (rebuilds ledger + balances from `bookings`).
- [ ] Verify customer counts: `SELECT COUNT(*) FROM public.customers;` should match `SELECT COUNT(DISTINCT restaurant_id, customer_email, customer_phone) FROM public.bookings;`.
- [ ] Spot-check a few profiles: ensure `total_bookings`, `total_covers`, and marketing flags reflect bookings history.
- [ ] Validate loyalty balances: sum of `loyalty_points.balance` per customer equals `SUM(loyalty_points_awarded)` from bookings.
- [ ] Confirm analytics events arriving by tailing `SELECT event_type, payload FROM public.analytics_events ORDER BY occurred_at DESC LIMIT 10;` during booking flows.

## Backfill script
Re-runable helper located at `scripts/db/backfill-customers-loyalty.sql`. Usage:

```bash
psql "$DATABASE_URL" -f scripts/db/backfill-customers-loyalty.sql
```

Exercises:
1. Normalises contacts and upserts `customers`.
2. Re-derives `customer_profiles` snapshots.
3. Rebuilds `loyalty_points` aggregates and `loyalty_point_events` ledger.

## Analytics schema v1
`analytics_events` enforces per-event payload contracts via CHECK constraints. Current critical events:

| Event                | Trigger                                   | Notes |
|----------------------|--------------------------------------------|-------|
| `booking.created`    | Initial booking creation (even if pending) | Includes loyalty award + waitlist flag. |
| `booking.waitlisted` | Booking falls back to waitlist             | `waitlist_id` & queue position recorded. |
| `booking.allocated`  | Booking assigned/reassigned to a table     | `allocation_status` enumerates `allocated` vs `reallocated`. |
| `booking.cancelled`  | Customer-driven cancellation               | Captures `previous_status` and cancellation actor. |

> Schema version is embedded in `payload.version` and mirrored in the `schema_version` column. Bumping fields requires incrementing both.

## Feature flagging loyalty accrual
Loyalty is opt-in via

```bash
export LOYALTY_PILOT_RESTAURANT_IDS="uuid-1,uuid-2"
```

Only programs marked `pilot_only = true` and whose restaurant id appears in the env list accrue points during booking confirmation.

## Monitoring & rollback
- Re-run the backfill script to recover from drift (e.g., manual edits).
- `public.analytics_events` can be cleared per tenant with `DELETE` if you need to replay; events recreate on next booking lifecycle action.
- Ledger rebuild is lossy for manual adjustments; capture manual corrections separately before re-running.
