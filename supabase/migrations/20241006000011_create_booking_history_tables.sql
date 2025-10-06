-- Create booking_versions and audit_logs tables for tracking history

-- Create change_type enum for booking versions
CREATE TYPE booking_change_type AS ENUM ('created', 'updated', 'cancelled', 'deleted');

-- Create booking_versions table for tracking booking changes over time
CREATE TABLE IF NOT EXISTS public.booking_versions (
  version_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  change_type booking_change_type NOT NULL,
  changed_by text NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  old_data jsonb NULL,
  new_data jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create audit_logs table for general audit trail
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity text NOT NULL,
  entity_id text NOT NULL,
  action text NOT NULL,
  actor text NULL,
  metadata jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.booking_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Policies for booking_versions
CREATE POLICY "Service role can manage booking versions"
  ON public.booking_versions
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Restaurant staff can view booking versions"
  ON public.booking_versions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurant_memberships rm
      WHERE rm.restaurant_id = booking_versions.restaurant_id
      AND rm.user_id = auth.uid()
    )
  );

-- Policies for audit_logs
CREATE POLICY "Service role can manage audit logs"
  ON public.audit_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Indexes for booking_versions
CREATE INDEX IF NOT EXISTS idx_booking_versions_booking_id 
ON public.booking_versions(booking_id);

CREATE INDEX IF NOT EXISTS idx_booking_versions_restaurant_id 
ON public.booking_versions(restaurant_id);

CREATE INDEX IF NOT EXISTS idx_booking_versions_changed_at 
ON public.booking_versions(changed_at DESC);

-- Indexes for audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id 
ON public.audit_logs(entity, entity_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at 
ON public.audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action 
ON public.audit_logs(action);
