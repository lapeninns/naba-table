-- ============================================================================
-- Migration: Create Missing audit_logs Table
-- ============================================================================
-- 
-- This table was defined in TypeScript types but missing from production DB.
-- Required by confirm_hold_assignment_tx function.
-- ============================================================================

-- Create the audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    actor TEXT,
    entity TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);

-- Enable RLS (consistent with security hardening)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for service_role access (skip if exists)
DO $$ BEGIN
    DROP POLICY IF EXISTS "service_role_all" ON public.audit_logs;
    CREATE POLICY "service_role_all" ON public.audit_logs
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Verify
SELECT 
    schemaname, 
    tablename, 
    rowsecurity,
    (SELECT COUNT(*) FROM public.audit_logs) as row_count
FROM pg_tables 
WHERE tablename = 'audit_logs';
