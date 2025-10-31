-- MIGRATION 20251103090600: BACKFILL GLOBAL CUSTOMER DATA
-- Populates user_profiles from auth.users and links existing customers via the new foreign key.

BEGIN;

SET LOCAL statement_timeout = '0';

-- STEP 1: Upsert profiles from auth.users (idempotent).
INSERT INTO public.user_profiles (id, name, email, phone, marketing_opt_in, created_at, updated_at)
SELECT
    u.id,
    NULLIF(trim((u.raw_user_meta_data->>'full_name')::text), '') AS name,
    u.email::citext,
    NULLIF(u.phone, '') AS phone,
    CASE
        WHEN lower(COALESCE(u.raw_app_meta_data->>'marketing_opt_in', 'false')) = 'true' THEN true
        ELSE false
    END AS marketing_opt_in,
    u.created_at,
    u.updated_at
FROM auth.users u
ON CONFLICT (id) DO UPDATE
SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    marketing_opt_in = CASE
        WHEN EXCLUDED.marketing_opt_in IS NOT NULL THEN EXCLUDED.marketing_opt_in
        ELSE public.user_profiles.marketing_opt_in
    END,
    updated_at = EXCLUDED.updated_at;

-- STEP 2: Direct link where customers already reference auth_user_id.
UPDATE public.customers AS c
SET user_profile_id = c.auth_user_id
WHERE c.auth_user_id IS NOT NULL
  AND c.user_profile_id IS NULL;

-- STEP 3: Email-based mapping for remaining rows (per restaurant).
WITH mapped_by_email AS (
    SELECT DISTINCT ON (c.restaurant_id, p.id)
        c.id AS customer_id,
        p.id AS profile_id
    FROM public.customers c
    JOIN public.user_profiles p ON LOWER(c.email_normalized) = LOWER(p.email::text)
    WHERE c.user_profile_id IS NULL
      AND c.email_normalized IS NOT NULL
      AND c.email_normalized <> ''
)
UPDATE public.customers c
SET user_profile_id = mbe.profile_id
FROM mapped_by_email mbe
WHERE c.id = mbe.customer_id
  AND c.user_profile_id IS NULL;

-- STEP 4: Phone-based mapping for any remaining rows.
WITH mapped_by_phone AS (
    SELECT DISTINCT ON (c.restaurant_id, p.id)
        c.id AS customer_id,
        p.id AS profile_id
    FROM public.customers c
    JOIN public.user_profiles p ON c.phone_normalized = regexp_replace(p.phone, '[^0-9]+', '', 'g')
    WHERE c.user_profile_id IS NULL
      AND c.phone_normalized IS NOT NULL
      AND c.phone_normalized <> ''
      AND p.phone IS NOT NULL
)
UPDATE public.customers c
SET user_profile_id = mbp.profile_id
FROM mapped_by_phone mbp
WHERE c.id = mbp.customer_id
  AND c.user_profile_id IS NULL;

-- Optional collision report for manual review (uncomment as needed).
-- SELECT c.restaurant_id,
--        c.email_normalized,
--        COUNT(DISTINCT p.id) AS potential_profiles
-- FROM public.customers c
-- JOIN public.user_profiles p ON LOWER(c.email_normalized) = LOWER(p.email::text)
-- WHERE c.user_profile_id IS NULL
-- GROUP BY c.restaurant_id, c.email_normalized
-- HAVING COUNT(DISTINCT p.id) > 1;

COMMIT;
