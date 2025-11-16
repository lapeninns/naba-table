-- Capacity outbox operational indexes & dedupe safeguards
-- NOTE: CONCURRENTLY removed due to supabase db push pipeline execution

-- Replace legacy single-column dispatch indexes with a composite dispatcher helper
DROP INDEX IF EXISTS capacity_outbox_status_idx;
DROP INDEX IF EXISTS capacity_outbox_next_attempt_idx;
CREATE INDEX IF NOT EXISTS capacity_outbox_dispatch_idx
  ON public.capacity_outbox (status, next_attempt_at);
-- Replace legacy dedupe index with partial unique coverage across pending workloads
DROP INDEX IF EXISTS capacity_outbox_dedupe_unique;
CREATE UNIQUE INDEX IF NOT EXISTS capacity_outbox_dedupe
  ON public.capacity_outbox (
    event_type,
    COALESCE(dedupe_key, ''),
    COALESCE(idempotency_key, '')
  )
  WHERE status IN ('pending', 'processing');
