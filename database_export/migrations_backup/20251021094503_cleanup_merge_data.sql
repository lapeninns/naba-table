DELETE FROM public.allocations WHERE resource_type = 'merge_group';
ALTER TABLE public.booking_table_assignments
  DROP CONSTRAINT IF EXISTS booking_table_assignments_merge_group_id_fkey;
ALTER TABLE public.booking_table_assignments
  DROP COLUMN IF EXISTS merge_group_id;
DROP TABLE IF EXISTS public.merge_group_members CASCADE;
DROP TABLE IF EXISTS public.merge_groups CASCADE;
DROP TABLE IF EXISTS public.merge_rules CASCADE;
