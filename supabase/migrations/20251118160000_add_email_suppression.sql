-- MIGRATION 20251118160000: ADD EMAIL SUPPRESSION FLAG
-- Purpose: Add a flag to the user_profiles table to prevent sending emails to users who have unsubscribed, bounced, or marked as spam.

BEGIN;

SET LOCAL statement_timeout = '0';

-- Add the is_email_suppressed column to the global user profiles table.
-- It defaults to false for all existing and new users.
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS is_email_suppressed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user_profiles.is_email_suppressed IS 'If true, no emails (transactional or marketing) should be sent to this user. Set by webhook on bounce, spam complaint, or unsubscribe.';

COMMIT;
