-- Migration: Enforce adjacency connectivity for merge group members

BEGIN;

CREATE OR REPLACE FUNCTION public.are_tables_connected(table_ids uuid[])
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  unique_tables uuid[];
  start_table uuid;
  total_count integer;
  connected_count integer;
BEGIN
  SELECT array_agg(DISTINCT id)
  INTO unique_tables
  FROM unnest(table_ids) AS id
  WHERE id IS NOT NULL;

  total_count := array_length(unique_tables, 1);

  IF total_count IS NULL OR total_count = 0 THEN
    RETURN false;
  END IF;

  IF total_count = 1 THEN
    RETURN true;
  END IF;

  start_table := unique_tables[1];

  WITH RECURSIVE connected AS (
    SELECT start_table AS table_id
    UNION
    SELECT adj.table_b
    FROM connected
    JOIN public.table_adjacencies adj
      ON adj.table_a = connected.table_id
    WHERE adj.table_b = ANY(unique_tables)
  )
  SELECT COUNT(DISTINCT table_id)
  INTO connected_count
  FROM connected;

  RETURN connected_count = total_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_merge_group_members()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  table_ids uuid[];
  distinct_zones integer;
BEGIN
  SELECT array_agg(mgm.table_id)
  INTO table_ids
  FROM public.merge_group_members mgm
  WHERE mgm.merge_group_id = NEW.merge_group_id;

  table_ids := array_append(COALESCE(table_ids, '{}'::uuid[]), NEW.table_id);

  SELECT COUNT(DISTINCT ti.zone_id)
  INTO distinct_zones
  FROM public.table_inventory ti
  WHERE ti.id = ANY(table_ids);

  IF distinct_zones IS NULL OR distinct_zones = 0 THEN
    RAISE EXCEPTION 'Merge group % references tables that do not exist', NEW.merge_group_id;
  END IF;

  IF distinct_zones > 1 THEN
    RAISE EXCEPTION 'Merge group % cannot span multiple zones', NEW.merge_group_id;
  END IF;

  IF array_length(table_ids, 1) > 1 AND NOT public.are_tables_connected(table_ids) THEN
    RAISE EXCEPTION 'Merge group % includes tables without adjacency connectivity', NEW.merge_group_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS merge_group_members_validate_connectivity ON public.merge_group_members;
CREATE TRIGGER merge_group_members_validate_connectivity
  BEFORE INSERT ON public.merge_group_members
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_merge_group_members();

COMMIT;
