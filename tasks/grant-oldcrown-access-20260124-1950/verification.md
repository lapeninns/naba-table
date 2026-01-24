---
task: grant-oldcrown-access
timestamp_utc: 2026-01-24T19:50:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Verification Report

## Supabase MCP

- [x] User lookup by email (`oldcrown@lapeninns.com` → user id `2a4f9524-937f-466d-94d1-f59f021ae488`)
- [x] Restaurant lookup by name (“The Old Crown Girton” → id `a050d1ad-1ee0-4ea0-abc2-22c3778aa52c`)
- [x] Membership insert/update verified (role `manager`)

## Artifacts

- Query outputs recorded below.

## Query Evidence

- Restaurant lookup: `select id, name, slug from public.restaurants where lower(name) like '%old crown%'`
- User lookup: `select id, email from auth.users where lower(email) = 'oldcrown@lapeninns.com'`
- Role lookup: `select distinct role from public.restaurant_memberships order by role`
- Membership upsert: `insert into public.restaurant_memberships (...) on conflict (user_id, restaurant_id) do update ...`
- Verification: `select user_id, restaurant_id, role, created_at from public.restaurant_memberships ...`

## Known Issues

- [ ] None
