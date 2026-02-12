-- Add email_templates column to restaurants table
alter table "public"."restaurants"
add column "email_templates" jsonb default null;

comment on column "public"."restaurants"."email_templates" is 'Custom email templates overriding system defaults. Keyed by email type (e.g., "created", "reminder").';


-- ---------------------------------------------------------------------------
-- MERGED FROM: 20251226_add_google_review_url.sql
-- ---------------------------------------------------------------------------

-- Migration: Add google_review_url to restaurants table
-- This field allows restaurant owners to specify their Google Review link
-- which will be used in post-dining review request emails

ALTER TABLE restaurants 
ADD COLUMN IF NOT EXISTS google_review_url TEXT;

COMMENT ON COLUMN restaurants.google_review_url IS 'Google Review URL for post-dining review request emails';
