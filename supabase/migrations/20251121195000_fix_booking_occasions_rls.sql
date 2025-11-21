-- Enable RLS on booking_occasions and add read policy
BEGIN;

ALTER TABLE public.booking_occasions ENABLE ROW LEVEL SECURITY;

-- Allow everyone (including anon for booking widget) to read booking occasions
CREATE POLICY "Allow public read access to booking_occasions"
    ON public.booking_occasions
    FOR SELECT
    TO public
    USING (true);

COMMIT;
