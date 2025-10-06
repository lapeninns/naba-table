-- Add missing booking_status enum values to match application code

-- Add 'pending_allocation' status
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'pending_allocation';

-- The application code uses: pending, pending_allocation, confirmed, cancelled
-- The database already has: confirmed, pending, cancelled, completed, no_show
-- So we're adding 'pending_allocation' to match the app code
