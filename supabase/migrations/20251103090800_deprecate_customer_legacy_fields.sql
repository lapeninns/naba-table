-- MIGRATION 20251103090800: [FUTURE] DEPRECATE LEGACY CUSTOMER FIELDS
-- WARNING: Do not apply until all clients populate customer.user_profile_id and legacy columns are unused.

BEGIN;

-- This migration is intentionally inert until the team is ready to enforce the NOT NULL constraint.
-- Uncomment the statements below when adoption is complete and validated in production.

-- ALTER TABLE public.customers
--   ALTER COLUMN user_profile_id SET NOT NULL;

-- Example clean-up (run in later milestone):
-- ALTER TABLE public.customers DROP COLUMN auth_user_id;
-- ALTER TABLE public.customers DROP COLUMN full_name;
-- ALTER TABLE public.customers DROP COLUMN email;
-- ALTER TABLE public.customers DROP COLUMN phone;

COMMIT;
