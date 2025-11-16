-- Ensure staff APIs can read table holds through the authenticated role.
-- +goose Up
GRANT SELECT ON TABLE public.table_holds TO authenticated;
GRANT SELECT ON TABLE public.table_hold_members TO authenticated;
-- +goose Down
REVOKE SELECT ON TABLE public.table_hold_members FROM authenticated;
REVOKE SELECT ON TABLE public.table_holds FROM authenticated;
