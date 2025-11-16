-- Enable RLS and scoped policies for table holds and members
-- +goose Up
ALTER TABLE public.table_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_hold_members ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.table_holds TO service_role;
GRANT SELECT ON TABLE public.table_holds TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.table_hold_members TO service_role;
GRANT SELECT ON TABLE public.table_hold_members TO authenticated;
CREATE POLICY "Service role can manage table holds" ON public.table_holds
  TO service_role
  USING (true)
  WITH CHECK (true);
CREATE POLICY "Staff can view table holds" ON public.table_holds
  FOR SELECT
  TO authenticated
  USING (
    restaurant_id IN (
      SELECT public.user_restaurants() AS user_restaurants
    )
  );
CREATE POLICY "Service role can manage table hold members" ON public.table_hold_members
  TO service_role
  USING (true)
  WITH CHECK (true);
CREATE POLICY "Staff can view table hold members" ON public.table_hold_members
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.table_holds h
      WHERE h.id = table_hold_members.hold_id
        AND h.restaurant_id IN (
          SELECT public.user_restaurants() AS user_restaurants
        )
    )
  );
-- +goose Down
DROP POLICY IF EXISTS "Staff can view table hold members" ON public.table_hold_members;
DROP POLICY IF EXISTS "Service role can manage table hold members" ON public.table_hold_members;
DROP POLICY IF EXISTS "Staff can view table holds" ON public.table_holds;
DROP POLICY IF EXISTS "Service role can manage table holds" ON public.table_holds;
REVOKE SELECT ON TABLE public.table_hold_members FROM authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.table_hold_members FROM service_role;
REVOKE SELECT ON TABLE public.table_holds FROM authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.table_holds FROM service_role;
ALTER TABLE public.table_hold_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_holds DISABLE ROW LEVEL SECURITY;
