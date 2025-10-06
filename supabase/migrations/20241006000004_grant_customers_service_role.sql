-- Ensure service role can manage customer data during server-side mutations
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO service_role;

