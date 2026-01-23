-- Grant Oldcrown restaurant access to oldcrown@lapeninns.com (nabatable-pre-staging)
-- Valid roles: owner | manager | host | server

-- Sanity checks (should return 1 row each)
select id, email
from auth.users
where lower(email) = lower('oldcrown@lapeninns.com');

select id, name, slug
from public.restaurants
where slug = 'oldcrown';

-- Grant membership (idempotent)
with target_user as (
  select id
  from auth.users
  where lower(email) = lower('oldcrown@lapeninns.com')
  limit 1
),
 target_restaurant as (
  select id
  from public.restaurants
  where slug = 'oldcrown'
  limit 1
),
inserted as (
  insert into public.restaurant_memberships (user_id, restaurant_id, role)
  select u.id, r.id, 'manager'
  from target_user u
  join target_restaurant r on true
  where not exists (
    select 1
    from public.restaurant_memberships m
    where m.user_id = u.id
      and m.restaurant_id = r.id
  )
  returning *
)
select * from inserted;
