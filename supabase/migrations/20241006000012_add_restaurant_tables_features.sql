-- Add features column to restaurant_tables for storing table attributes

ALTER TABLE public.restaurant_tables 
ADD COLUMN IF NOT EXISTS features text[] NULL DEFAULT ARRAY[]::text[];

-- Create index for features array searches
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_features 
ON public.restaurant_tables USING GIN(features);
