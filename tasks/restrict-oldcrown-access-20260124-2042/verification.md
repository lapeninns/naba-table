---
task: restrict-oldcrown-access
timestamp_utc: 2026-01-24T20:42:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Verification Report

## Supabase MCP

- [x] User lookup
- [x] Memberships filtered
- [x] Post-delete verification

## Artifacts

- Query outputs recorded below.

## Query Evidence

- User lookup for `oldcrown@lapeninn.com` returned none; `oldcrown@lapeninns.com` matched user id `2a4f9524-937f-466d-94d1-f59f021ae488`.
- Deleted memberships where restaurant_id != Old Crown Girton.
- Verified only Old Crown Girton remains for user.

## Rollback SQL (if needed)

```sql
insert into public.restaurant_memberships (user_id, restaurant_id, role)
values
  ('2a4f9524-937f-466d-94d1-f59f021ae488', '088bcbb5-c9c8-46cc-b2bc-e4c15bdd47d4', 'manager'),
  ('2a4f9524-937f-466d-94d1-f59f021ae488', '486de541-a307-4414-b0b1-f774a0e4a9fa', 'manager')
on conflict (user_id, restaurant_id) do update set role = excluded.role;
```
