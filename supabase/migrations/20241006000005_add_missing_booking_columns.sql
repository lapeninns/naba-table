-- Add missing columns to bookings table

-- First, create the booking_type enum if it doesn't exist
DO $$ BEGIN
  CREATE TYPE booking_type AS ENUM ('breakfast', 'lunch', 'dinner', 'drinks');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add booking_type column (required, defaults to 'dinner')
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS booking_type booking_type NOT NULL DEFAULT 'dinner';

-- Add idempotency_key column (optional, for preventing duplicate bookings)
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS idempotency_key text NULL;

-- Add client_request_id column (required for tracking client requests)
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS client_request_id text NOT NULL DEFAULT gen_random_uuid()::text;

-- Add pending_ref column (optional, for pending bookings)
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS pending_ref text NULL;

-- Add details column (optional JSONB for additional metadata)
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS details jsonb NULL;

-- Add marketing_opt_in column (for customer marketing preferences at booking time)
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS marketing_opt_in boolean NOT NULL DEFAULT false;

-- Create index on idempotency_key for fast lookups
CREATE INDEX IF NOT EXISTS idx_bookings_idempotency_key 
ON public.bookings(idempotency_key) 
WHERE idempotency_key IS NOT NULL;

-- Create index on client_request_id for tracking
CREATE INDEX IF NOT EXISTS idx_bookings_client_request_id 
ON public.bookings(client_request_id);

-- Create index on pending_ref for pending booking lookups
CREATE INDEX IF NOT EXISTS idx_bookings_pending_ref 
ON public.bookings(pending_ref) 
WHERE pending_ref IS NOT NULL;
