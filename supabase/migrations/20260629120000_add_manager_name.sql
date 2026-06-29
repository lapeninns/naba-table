-- Migration: add_manager_name
-- Purpose:
--   Store the venue manager's display name on the restaurant profile so it can be
--   used as the personal "<manager> from <venue>" sender name on post-visit review
--   request emails. A personal sender lands in Gmail's Primary tab more often than a
--   venue-branded one. Display-name only: it does not affect the authenticated From
--   address or email auth (SPF/DKIM/DMARC).

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS manager_name text;

ALTER TABLE public.restaurants
  DROP CONSTRAINT IF EXISTS restaurants_manager_name_check;
ALTER TABLE public.restaurants
  ADD CONSTRAINT restaurants_manager_name_check
  CHECK (
    manager_name IS NULL
    OR char_length(manager_name) <= 80
  );

COMMENT ON COLUMN public.restaurants.manager_name IS
  'Manager display name used as the personal sender ("<manager> from <venue>") on review-request emails.';
