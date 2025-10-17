-- Migration: Add confirmation token columns to bookings table
-- Purpose: Enable one-time token-based guest confirmation page access
-- Sprint: Route Versioning & Auth Cleanup (EPIC B3)
-- Date: 2025-01-15

-- Add confirmation token columns
ALTER TABLE public.bookings
ADD COLUMN confirmation_token VARCHAR(64),
ADD COLUMN confirmation_token_expires_at TIMESTAMPTZ,
ADD COLUMN confirmation_token_used_at TIMESTAMPTZ;

-- Add unique constraint on confirmation_token
ALTER TABLE public.bookings
ADD CONSTRAINT bookings_confirmation_token_unique UNIQUE (confirmation_token);

-- Create index for token lookup (partial index for non-null tokens)
CREATE INDEX idx_bookings_confirmation_token 
ON public.bookings(confirmation_token) 
WHERE confirmation_token IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.bookings.confirmation_token IS 
  'One-time cryptographic token (base64url, 64 chars) for guest confirmation page access. Expires in 1 hour.';

COMMENT ON COLUMN public.bookings.confirmation_token_expires_at IS 
  'Expiry timestamp for confirmation_token. After this time, token is invalid.';

COMMENT ON COLUMN public.bookings.confirmation_token_used_at IS 
  'Timestamp when confirmation_token was first used. Prevents token replay attacks.';
