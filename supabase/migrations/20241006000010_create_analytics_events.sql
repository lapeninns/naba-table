-- Create analytics_event_type enum and analytics_events table

-- Create the analytics event type enum
CREATE TYPE analytics_event_type AS ENUM (
  'booking.created',
  'booking.cancelled',
  'booking.allocated',
  'booking.waitlisted'
);

-- Create analytics_events table for tracking booking lifecycle events
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type analytics_event_type NOT NULL,
  schema_version text NOT NULL,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  customer_id uuid NULL REFERENCES public.customers(id) ON DELETE SET NULL,
  emitted_by text NOT NULL DEFAULT 'server',
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on analytics_events
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can manage analytics events
CREATE POLICY "Service role can manage analytics events"
  ON public.analytics_events
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Policy: Restaurant staff can view their restaurant's analytics
CREATE POLICY "Restaurant staff can view analytics"
  ON public.analytics_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurant_memberships rm
      WHERE rm.restaurant_id = analytics_events.restaurant_id
      AND rm.user_id = auth.uid()
    )
  );

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_analytics_events_restaurant_id 
ON public.analytics_events(restaurant_id);

CREATE INDEX IF NOT EXISTS idx_analytics_events_booking_id 
ON public.analytics_events(booking_id);

CREATE INDEX IF NOT EXISTS idx_analytics_events_customer_id 
ON public.analytics_events(customer_id)
WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type 
ON public.analytics_events(event_type);

CREATE INDEX IF NOT EXISTS idx_analytics_events_occurred_at 
ON public.analytics_events(occurred_at DESC);

-- Composite index for restaurant + time-based queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_restaurant_occurred 
ON public.analytics_events(restaurant_id, occurred_at DESC);
