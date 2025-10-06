-- Add pilot_only column to loyalty_programs for feature flagging

ALTER TABLE public.loyalty_programs 
ADD COLUMN IF NOT EXISTS pilot_only boolean NOT NULL DEFAULT false;
