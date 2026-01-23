-- Verification checks for oldcrown access (nabatable-pre-staging)

-- 1) User exists?
select id, email
from auth.users
where lower(email) = lower('oldcrown@lapeninns.com');

-- 2) Restaurant exists?
select id, name, slug
from public.restaurants
where slug = 'oldcrown';

-- 3) Membership exists?
select m.user_id, m.restaurant_id, m.role, r.name, r.slug
from public.restaurant_memberships m
join public.restaurants r on r.id = m.restaurant_id
join auth.users u on u.id = m.user_id
where lower(u.email) = lower('oldcrown@lapeninns.com')
  and r.slug = 'oldcrown';
