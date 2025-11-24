-- Add active flag to zones for seasonal availability control
ALTER TABLE public.zones
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- Ensure existing records are enabled
UPDATE public.zones SET active = true WHERE active IS NULL;

COMMENT ON COLUMN public.zones.active IS 'Indicates whether the zone is currently in service';
