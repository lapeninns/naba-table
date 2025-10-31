-- MIGRATION 20251103090700: VALIDATE BOOKING LIFECYCLE CONSTRAINT

BEGIN;

SET LOCAL statement_timeout = '0';

ALTER TABLE public.bookings
  VALIDATE CONSTRAINT bookings_lifecycle_timestamp_consistency;

COMMIT;
