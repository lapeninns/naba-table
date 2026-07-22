-- Make customers.email / customers.phone nullable (forward-only re-issue).
--
-- Why: production still has NOT NULL on both columns — the pre-baseline
-- 20251231_optional_contact_fields.sql was never applied there (it predates
-- the 2026-02-08 baseline). With phone NOT NULL plus
-- customers_phone_check (length(phone) BETWEEN 7 AND 20), an email-only
-- public booking could not store a customer at all: the app inserted '' which
-- violates the length CHECK (46 booking 500s between 2026-07-13 and
-- 2026-07-19). App code now stores NULL for an absent phone and maps DB
-- rejections to a controlled 422 PHONE_REQUIRED; applying this migration is
-- the actual enablement that lets email-only bookings succeed.
--
-- Idempotent: DROP NOT NULL is a no-op when already nullable, and the
-- constraint is dropped/re-added under the same name used by the 20251231
-- file, so environments where that file DID apply (e.g. staging) converge.
--
-- Safety: existing rows all carry at least one non-empty contact (the app has
-- always required one), so the CHECK validates without data fixes. The
-- normalized-key uniqueness for absent contacts is already handled by the
-- partial unique indexes from 20260705133500 (WHERE <> ''); generated
-- *_normalized columns yield NULL for NULL inputs, which the partial indexes
-- likewise ignore.
--
-- ROLLBACK PLAN:
--   1. UPDATE customers SET phone/email to placeholder values where NULL
--      (none are expected to exist immediately after applying).
--   2. ALTER TABLE public.customers DROP CONSTRAINT customers_contact_required;
--   3. ALTER TABLE public.customers
--        ALTER COLUMN email SET NOT NULL,
--        ALTER COLUMN phone SET NOT NULL;

BEGIN;

ALTER TABLE public.customers
  ALTER COLUMN email DROP NOT NULL,
  ALTER COLUMN phone DROP NOT NULL;

ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_contact_required;

ALTER TABLE public.customers
  ADD CONSTRAINT customers_contact_required
  CHECK (
    (email IS NOT NULL AND email != '')
    OR
    (phone IS NOT NULL AND phone != '')
  );

COMMENT ON CONSTRAINT customers_contact_required ON public.customers IS
  'Ensures at least one contact method (email or phone) is provided';

COMMIT;
