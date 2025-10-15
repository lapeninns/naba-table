-- Rollback: Remove confirmation token columns from bookings table
-- WARNING: This will permanently delete all confirmation tokens
-- Date: 2025-01-15

-- Drop index
DROP INDEX IF EXISTS public.idx_bookings_confirmation_token;

-- Remove unique constraint
ALTER TABLE public.bookings
DROP CONSTRAINT IF EXISTS bookings_confirmation_token_unique;

-- Drop columns
ALTER TABLE public.bookings
DROP COLUMN IF EXISTS confirmation_token,
DROP COLUMN IF EXISTS confirmation_token_expires_at,
DROP COLUMN IF EXISTS confirmation_token_used_at;
