-- Ensure allocations.resource_type allows hold mirrors created by manual holds.
-- +goose Up
ALTER TABLE public.allocations
  DROP CONSTRAINT IF EXISTS allocations_resource_type_check;

ALTER TABLE public.allocations
  ADD CONSTRAINT allocations_resource_type_check
    CHECK (resource_type = ANY (ARRAY['table'::text, 'hold'::text, 'merge_group'::text]));

-- +goose Down
ALTER TABLE public.allocations
  DROP CONSTRAINT IF EXISTS allocations_resource_type_check;

ALTER TABLE public.allocations
  ADD CONSTRAINT allocations_resource_type_check
    CHECK (resource_type = ANY (ARRAY['table'::text, 'merge_group'::text]));
