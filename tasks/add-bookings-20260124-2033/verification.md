---
task: add-bookings
timestamp_utc: 2026-01-24T20:33:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Supabase MCP

- [x] Schema inspected
- [x] Insert completed (45 bookings)
- [x] Count verified (45 for 2026-01-25)

## Artifacts

- Query outputs recorded below.

## Query Evidence

- Restaurant lookup: `select id, name, slug, timezone from public.restaurants ...`
- Schema: `information_schema.columns` for `bookings` and `customers`
- Insert CTE recorded in MCP history (45 inserted)
- Verification: count of seeded bookings for 2026-01-25 returned 45

## Rollback SQL (if needed)

```sql
delete from public.bookings
where restaurant_id = 'a050d1ad-1ee0-4ea0-abc2-22c3778aa52c'
  and booking_date = '2026-01-25'
  and notes = 'Test booking seeded for ops';

delete from public.customers
where restaurant_id = 'a050d1ad-1ee0-4ea0-abc2-22c3778aa52c'
  and email like 'test.oc.%@lapeninns.example';
```
