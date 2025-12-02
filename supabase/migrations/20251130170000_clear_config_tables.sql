-- Clear legacy configuration tables now that configuration lives in code/env.
-- Tables are preserved to avoid breaking dependencies in database functions.
-- Safe to run even if tables don't exist.

DO $$
BEGIN
    -- Clear strategic_configs if it exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'strategic_configs') THEN
        DELETE FROM public.strategic_configs;
    END IF;
    
    -- Clear feature_flag_overrides if it exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'feature_flag_overrides') THEN
        DELETE FROM public.feature_flag_overrides;
    END IF;
END$$;
