-- Adds RLS and policies for profile update idempotency table

-- Run policies only if the table exists. This makes the migration safe when the
-- corresponding create-table migration is missing or runs later.
DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profile_update_requests'
  ) THEN
    -- Enable RLS
    EXECUTE 'ALTER TABLE public.profile_update_requests ENABLE ROW LEVEL SECURITY';

    -- Drop policies if they exist (idempotent)
    EXECUTE $sql$
      DROP POLICY IF EXISTS profile_update_requests_select ON public.profile_update_requests;
      DROP POLICY IF EXISTS profile_update_requests_insert ON public.profile_update_requests;
      DROP POLICY IF EXISTS profile_update_requests_update ON public.profile_update_requests;
      DROP POLICY IF EXISTS profile_update_requests_delete ON public.profile_update_requests;
    $sql$;

    -- Create policies - users can only manage their own idempotency records
    EXECUTE $sql$
      CREATE POLICY profile_update_requests_select
        ON public.profile_update_requests
        FOR SELECT
        USING (auth.uid() = profile_id);

      CREATE POLICY profile_update_requests_insert
        ON public.profile_update_requests
        FOR INSERT
        WITH CHECK (auth.uid() = profile_id);

      CREATE POLICY profile_update_requests_update
        ON public.profile_update_requests
        FOR UPDATE
        USING (auth.uid() = profile_id)
        WITH CHECK (auth.uid() = profile_id);

      CREATE POLICY profile_update_requests_delete
        ON public.profile_update_requests
        FOR DELETE
        USING (auth.uid() = profile_id);
    $sql$;
  END IF;
END
$do$;
