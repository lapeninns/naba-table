ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS logo_url text;;
COMMENT ON COLUMN public.restaurants.logo_url IS 'Publicly accessible logo URL used in outbound communications.';;
