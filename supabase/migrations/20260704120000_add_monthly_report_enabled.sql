-- Add monthly_report_enabled column to restaurants table
-- Default to true so existing venues get the monthly report email sent to them

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS monthly_report_enabled boolean DEFAULT true NOT NULL;

-- Index for fast lookups during the cron job
CREATE INDEX IF NOT EXISTS idx_restaurants_monthly_report_enabled
  ON public.restaurants(monthly_report_enabled)
  WHERE monthly_report_enabled = true AND contact_email IS NOT NULL;
