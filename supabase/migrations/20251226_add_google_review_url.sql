-- Migration: Add google_review_url to restaurants table
-- This field allows restaurant owners to specify their Google Review link
-- which will be used in post-dining review request emails

ALTER TABLE restaurants 
ADD COLUMN IF NOT EXISTS google_review_url TEXT;

COMMENT ON COLUMN restaurants.google_review_url IS 'Google Review URL for post-dining review request emails';
