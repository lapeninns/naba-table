-- Checks for staging access issues (permission denied for schema public)

-- 0) Schema usage privileges
select
  has_schema_privilege('anon', 'public', 'USAGE') as anon_usage,
  has_schema_privilege('authenticated', 'public', 'USAGE') as authenticated_usage,
  has_schema_privilege('service_role', 'public', 'USAGE') as service_role_usage;

-- 1) Table grants for restaurant_memberships
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'restaurant_memberships'
  and grantee in ('anon', 'authenticated', 'service_role')
order by grantee, privilege_type;

-- 2) RLS status for restaurant_memberships
select c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'restaurant_memberships';

-- 3) RLS policies for restaurant_memberships
select policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'restaurant_memberships';

-- 4) User exists?
select id, email
from auth.users
where lower(email) = lower('oldcrown@lapeninns.com');

-- 5) Restaurant exists?
select id, name, slug
from public.restaurants
where slug = 'oldcrown';

-- 6) Membership exists?
select m.user_id, m.restaurant_id, m.role, r.name, r.slug
from public.restaurant_memberships m
join public.restaurants r on r.id = m.restaurant_id
join auth.users u on u.id = m.user_id
where lower(u.email) = lower('oldcrown@lapeninns.com')
  and r.slug = 'oldcrown';

-- Optional fix (run only if schema usage is false)
-- grant usage on schema public to anon, authenticated, service_role;
