-- Migration: add_restaurant_sms_display_name
-- Purpose:
--   Let each venue use a compact, tenant-owned name in SMS messages without
--   changing its public, email, or WhatsApp display name.

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS sms_display_name text;

ALTER TABLE public.restaurants
  DROP CONSTRAINT IF EXISTS restaurants_sms_display_name_check;
ALTER TABLE public.restaurants
  ADD CONSTRAINT restaurants_sms_display_name_check
  CHECK (
    sms_display_name IS NULL
    OR (
      sms_display_name = btrim(sms_display_name)
      AND char_length(sms_display_name) BETWEEN 2 AND 40
    )
  );

UPDATE public.restaurants
SET sms_display_name = CASE name
  WHEN 'The Corner House Pub (Cambridge)' THEN 'Corner House Cambridge'
  WHEN 'The Old Crown Girton' THEN 'Old Crown Girton'
  WHEN 'The Old School House' THEN 'Old School House'
  ELSE sms_display_name
END
WHERE sms_display_name IS NULL
  AND name IN (
    'The Corner House Pub (Cambridge)',
    'The Old Crown Girton',
    'The Old School House'
  );

COMMENT ON COLUMN public.restaurants.sms_display_name IS
  'Optional compact venue name used only in outbound SMS messages.';
