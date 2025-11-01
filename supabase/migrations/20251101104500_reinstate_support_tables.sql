-- Reinstate support tables referenced by application code and ensure consistent policies.
-- This migration recreates merge_rules (dropped by cleanup), formalises leads capture,
-- and adds a first-class waiting list table so Supabase schema matches server expectations.

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'merge_rules'
  ) THEN
    EXECUTE $$
      CREATE TABLE public.merge_rules (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        from_a smallint NOT NULL,
        from_b smallint NOT NULL,
        to_capacity smallint NOT NULL,
        enabled boolean NOT NULL DEFAULT true,
        require_same_zone boolean NOT NULL DEFAULT true,
        require_adjacency boolean NOT NULL DEFAULT true,
        cross_category_merge boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
        updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
        CONSTRAINT merge_rules_positive CHECK (from_a > 0 AND from_b > 0 AND to_capacity > 0)
      )
    $$;

    EXECUTE $$CREATE UNIQUE INDEX merge_rules_from_to_idx
              ON public.merge_rules (from_a, from_b, to_capacity)$$;

    EXECUTE $$CREATE TRIGGER merge_rules_updated_at
              BEFORE UPDATE ON public.merge_rules
              FOR EACH ROW
              EXECUTE FUNCTION public.update_updated_at()$$;

    EXECUTE $$ALTER TABLE public.merge_rules ENABLE ROW LEVEL SECURITY$$;

    EXECUTE $$CREATE POLICY "Service role can manage merge rules"
              ON public.merge_rules
              USING (true)
              WITH CHECK (true)
              TO service_role$$;

    EXECUTE $$CREATE POLICY "Staff can view merge rules"
              ON public.merge_rules
              FOR SELECT
              USING (true)
              TO authenticated, anon$$;

    EXECUTE $$GRANT SELECT, INSERT, UPDATE, DELETE ON public.merge_rules TO service_role$$;
    EXECUTE $$GRANT SELECT ON public.merge_rules TO authenticated, anon$$;
  END IF;
END;
$migration$;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'waiting_list'
  ) THEN
    EXECUTE $$
      CREATE TABLE public.waiting_list (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
        booking_date date NOT NULL,
        desired_time time NOT NULL,
        party_size integer NOT NULL CHECK (party_size > 0),
        seating_preference public.seating_preference_type NOT NULL DEFAULT 'any',
        customer_name text NOT NULL,
        customer_email text NOT NULL,
        customer_phone text,
        notes text,
        created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
        updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
      )
    $$;

    EXECUTE $$CREATE INDEX waiting_list_restaurant_date_time_idx
              ON public.waiting_list (restaurant_id, booking_date, desired_time, created_at)$$;

    EXECUTE $$CREATE UNIQUE INDEX waiting_list_customer_unique_idx
              ON public.waiting_list (restaurant_id, booking_date, desired_time, customer_email, COALESCE(customer_phone, ''))$$;

    EXECUTE $$CREATE TRIGGER waiting_list_updated_at
              BEFORE UPDATE ON public.waiting_list
              FOR EACH ROW
              EXECUTE FUNCTION public.update_updated_at()$$;

    EXECUTE $$ALTER TABLE public.waiting_list ENABLE ROW LEVEL SECURITY$$;

    EXECUTE $$CREATE POLICY "Service role manage waiting list"
              ON public.waiting_list
              USING (true)
              WITH CHECK (true)
              TO service_role$$;

    EXECUTE $$CREATE POLICY "Staff manage waiting list"
              ON public.waiting_list
              USING (restaurant_id IN (SELECT public.user_restaurants()))
              WITH CHECK (restaurant_id IN (SELECT public.user_restaurants()))
              TO authenticated$$;

    EXECUTE $$GRANT SELECT, INSERT, UPDATE, DELETE ON public.waiting_list TO service_role$$;
    EXECUTE $$GRANT SELECT, INSERT, UPDATE, DELETE ON public.waiting_list TO authenticated$$;
  END IF;
END;
$migration$;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'leads'
  ) THEN
    EXECUTE $$
      CREATE TABLE public.leads (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
      )
    $$;

    EXECUTE $$ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY$$;

    EXECUTE $$CREATE POLICY "Public can insert leads"
              ON public.leads
              FOR INSERT
              WITH CHECK (true)
              TO anon, authenticated, service_role$$;

    EXECUTE $$CREATE POLICY "Service role can read leads"
              ON public.leads
              FOR SELECT
              USING (true)
              TO service_role$$;

    EXECUTE $$GRANT SELECT ON public.leads TO service_role$$;
    EXECUTE $$GRANT INSERT ON public.leads TO anon, authenticated, service_role$$;
  END IF;
END;
$migration$;
