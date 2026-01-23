-- Fix schema usage + basic grants for restaurant memberships access (staging)

-- 1) Ensure roles can use schema public
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- 2) Ensure table privileges (RLS still applies)
GRANT SELECT ON TABLE public.restaurants TO anon, authenticated;
GRANT SELECT ON TABLE public.restaurant_memberships TO authenticated;
GRANT SELECT ON TABLE public.restaurant_memberships TO service_role;

-- Optional: if you need to INSERT memberships with service_role only
-- (do NOT grant INSERT to authenticated unless you want client-side writes)
GRANT INSERT ON TABLE public.restaurant_memberships TO service_role;

-- Verify grants
select
  has_schema_privilege('anon', 'public', 'USAGE') as anon_usage,
  has_schema_privilege('authenticated', 'public', 'USAGE') as authenticated_usage,
  has_schema_privilege('service_role', 'public', 'USAGE') as service_role_usage;

select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('restaurants', 'restaurant_memberships')
  and grantee in ('anon', 'authenticated', 'service_role')
order by table_name, grantee, privilege_type;
