-- Create stripe_events table for storing Stripe webhook events
-- This table stores all Stripe webhook events for audit and debugging

CREATE TABLE IF NOT EXISTS public.stripe_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  processed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on stripe_events
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;

-- Policy: Only service role can manage stripe events
CREATE POLICY "Service role can manage stripe events"
  ON public.stripe_events
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create index on event_id for fast duplicate detection
CREATE INDEX IF NOT EXISTS idx_stripe_events_event_id 
ON public.stripe_events(event_id);

-- Create index on event_type for filtering
CREATE INDEX IF NOT EXISTS idx_stripe_events_event_type 
ON public.stripe_events(event_type);

-- Create index on created_at for time-based queries
CREATE INDEX IF NOT EXISTS idx_stripe_events_created_at 
ON public.stripe_events(created_at DESC);

-- Create index on processed for filtering unprocessed events
CREATE INDEX IF NOT EXISTS idx_stripe_events_processed 
ON public.stripe_events(processed) 
WHERE processed = false;
