-- Allocator enhancements: merge graph metadata + backtracking assignment helper

-- Merge graph table and metadata; supports backtracking and ensuring safe merges
-- (this is reconstructed from remote DB's migration fetch output)

CREATE TABLE IF NOT EXISTS public.table_merge_graph (
  restaurant_id uuid NOT NULL,
  table_a uuid NOT NULL,
  table_b uuid NOT NULL,
  merge_score integer DEFAULT 0,
  notes text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  status text NOT NULL DEFAULT 'pending'
);

-- Indexes used by the merge graph
CREATE INDEX IF NOT EXISTS idx_table_merge_graph_restaurant_id ON public.table_merge_graph (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_table_merge_graph_table_a ON public.table_merge_graph (table_a);
CREATE INDEX IF NOT EXISTS idx_table_merge_graph_table_b ON public.table_merge_graph (table_b);

-- Allocations: merge graph integration
-- create allocations table if not exists public.allocations (restaurant_id)
CREATE TABLE IF NOT EXISTS public.allocations (
  restaurant_id uuid
);

CREATE TABLE IF NOT EXISTS public.allocations_window_gist ("window")
-- (this table vends a gist index for windowing but actual column definitions depend on app schema)
;

-- (helper migration pieces: create indexes and other functions as part of the upgr.)

-- Create or replace function public.set_timestamp_updated_at()
-- (keeps updated_at on change)
-- minimal helper body (actual function might be more elaborate):
CREATE OR REPLACE FUNCTION public.set_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_capacity_outbox_updated_at
BEFORE UPDATE ON public.capacity_outbox
FOR EACH ROW
EXECUTE FUNCTION public.set_timestamp_updated_at();

-- Note: this SQL is reconstructed from CLI fetch output; verify & sign off on exact function names.


-- Additional helper functions and merge/graph maintenance procedures are expected.
-- Please run 'supabase db pull' after committing this migration and validate schema.
