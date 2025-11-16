-- Allocator enhancements: merge graph metadata + backtracking assignment helper

-- 1) Merge graph allows the planner to discover preferred merge pairs.
create table if not exists public.table_merge_graph (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  table_a uuid not null references public.table_inventory(id) on delete cascade,
  table_b uuid not null references public.table_inventory(id) on delete cascade,
  merge_score integer default 0,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint table_merge_graph_pk primary key (restaurant_id, table_a, table_b)
);
create index if not exists table_merge_graph_restaurant_idx on public.table_merge_graph (restaurant_id, table_a);
create index if not exists table_merge_graph_reverse_idx on public.table_merge_graph (restaurant_id, table_b);
-- 2) Helper function to try multiple candidate table sets before surfacing an overlap failure.
create or replace function public.assign_tables_backtracking(
  p_booking_id uuid,
  p_table_candidates uuid[][],
  p_idempotency_key text default null,
  p_require_adjacency boolean default true,
  p_assigned_by uuid default null
)
returns table(table_id uuid, start_at timestamptz, end_at timestamptz, merge_group_id uuid)
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  candidate uuid[];
  attempt int := 0;
  attempt_key text;
  last_error text := null;
begin
  if p_table_candidates is null or array_length(p_table_candidates, 1) is null then
    raise exception 'No candidate table sets supplied' using errcode = 'P0001';
  end if;

  foreach candidate slice 1 in array p_table_candidates loop
    if candidate is null or array_length(candidate, 1) is null then
      continue;
    end if;
    attempt := attempt + 1;
    attempt_key := case
      when p_idempotency_key is null then null
      else p_idempotency_key || '-alt' || lpad(attempt::text, 2, '0')
    end;
    begin
      return query
        select *
        from public.assign_tables_atomic_v2(
          p_booking_id,
          candidate,
          attempt_key,
          p_require_adjacency,
          p_assigned_by
        );
      return;
    exception
      when unique_violation or exclusion_violation then
        last_error := SQLERRM;
        continue;
      when others then
        last_error := SQLERRM;
        if position('allocations_no_overlap' in coalesce(SQLERRM, '')) > 0 then
          continue;
        end if;
        raise;
    end;
  end loop;

  raise exception 'allocations_no_overlap'
    using errcode = 'P0001', detail = coalesce(last_error, 'All candidate plans overlapped existing allocations');
end;
$$;
comment on function public.assign_tables_backtracking(uuid, uuid[][], text, boolean, uuid)
  is 'Attempts assign_tables_atomic_v2 for each provided table-set until one succeeds or all overlap existing allocations.';
