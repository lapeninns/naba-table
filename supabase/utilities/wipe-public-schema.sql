-- DANGER: Drops and recreates the public schema.
-- Run only after taking a fresh backup.

SET lock_timeout = '10s';
SET statement_timeout = '5min';

DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public AUTHORIZATION postgres;

GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

COMMENT ON SCHEMA public IS 'standard public schema';
