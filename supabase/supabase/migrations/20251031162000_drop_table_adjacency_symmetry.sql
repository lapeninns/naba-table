-- Remove automatic mirroring of table adjacency edges so directional storage is preserved.
DROP TRIGGER IF EXISTS table_adjacencies_sync ON public.table_adjacencies;
DROP FUNCTION IF EXISTS public.sync_table_adjacency_symmetry();
