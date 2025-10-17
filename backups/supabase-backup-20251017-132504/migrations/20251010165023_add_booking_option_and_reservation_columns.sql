-- Add booking_option column to restaurant_service_periods
ALTER TABLE public.restaurant_service_periods
  ADD COLUMN IF NOT EXISTS booking_option text NOT NULL DEFAULT 'drinks'
  CHECK (booking_option IN ('lunch', 'dinner', 'drinks'));

-- Add reservation settings to restaurants
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS reservation_interval_minutes integer NOT NULL DEFAULT 15
  CHECK (reservation_interval_minutes > 0 AND reservation_interval_minutes <= 180);

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS reservation_default_duration_minutes integer NOT NULL DEFAULT 90
  CHECK (reservation_default_duration_minutes BETWEEN 15 AND 300);
