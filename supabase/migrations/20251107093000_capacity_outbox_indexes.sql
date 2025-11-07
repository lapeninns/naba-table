-- Capacity outbox operational indexes & dedupe safeguards
-- NOTE: no transaction (CREATE INDEX CONCURRENTLY)

-- Replace legacy single-column dispatch indexes with a composite dispatcher helper
DROP INDEX IF EXISTS capacity_outbox_status_idx;
DROP INDEX IF EXISTS capacity_outbox_next_attempt_idx;

CREATE INDEX CONCURRENTLY IF NOT EXISTS capacity_outbox_dispatch_idx
  ON public.capacity_outbox (status, next_attempt_at);

-- Replace legacy dedupe index with partial unique coverage across pending workloads
DROP INDEX IF EXISTS capacity_outbox_dedupe_unique;

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS capacity_outbox_dedupe
  ON public.capacity_outbox (
    event_type,
    COALESCE(dedupe_key, ''),
    COALESCE(idempotency_key, '')
  )
  WHERE status IN ('pending', 'processing');
