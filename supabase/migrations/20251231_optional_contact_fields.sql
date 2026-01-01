-- Migration: Make email and phone optional in customers table
-- Date: 2025-12-31
-- Purpose: Allow ops staff to create walk-in bookings with either email OR phone
--
-- ROLLBACK PLAN:
-- If rollback is needed, execute the following in order:
--   1. UPDATE any customers with null email/phone to have valid values
--   2. ALTER TABLE customers DROP CONSTRAINT customers_contact_required;
--   3. ALTER TABLE customers 
--        ALTER COLUMN email SET NOT NULL,
--        ALTER COLUMN phone SET NOT NULL;
-- NOTE: Step 3 will fail if any customers exist with null email or phone.
--       Before rollback, ensure all customer records have both fields populated.

BEGIN;

-- Make email and phone nullable
ALTER TABLE customers 
  ALTER COLUMN email DROP NOT NULL,
  ALTER COLUMN phone DROP NOT NULL;

-- Add check constraint to ensure at least one contact method exists
ALTER TABLE customers
  ADD CONSTRAINT customers_contact_required 
  CHECK (
    (email IS NOT NULL AND email != '') 
    OR 
    (phone IS NOT NULL AND phone != '')
  );

-- Add comment for documentation
COMMENT ON CONSTRAINT customers_contact_required ON customers IS 
  'Ensures at least one contact method (email or phone) is provided';

COMMIT;
