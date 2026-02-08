-- Auto “all-to-all within zone” adjacency enforcement (movable-only)
--
-- Canonicalizes public.table_adjacencies and installs triggers that rebuild zone adjacency
-- as a complete directed graph among eligible movable tables.
--
-- Eligibility (within zone):
--  - zones.active IS DISTINCT FROM false
--  - table_inventory.active IS DISTINCT FROM false
--  - capacity > 0
--  - status not in out_of_service/maintenance (case-insensitive)
--  - mobility in movable/adjustable or NULL (case-insensitive; NULL treated as movable)

begin;

-- -----------------------------------------------------------------------------
-- 1) Canonicalize table_adjacencies
-- -----------------------------------------------------------------------------

create table if not exists public.table_adjacencies (
  table_a uuid not null,
  table_b uuid not null,
  created_at timestamptz not null default now()
);

-- Clean up any unexpected bad rows (defensive; should be impossible once NOT NULL is in force).
delete from public.table_adjacencies where table_a is null or table_b is null;
-- Remove duplicates (defensive; required before enforcing PK if drift exists).
delete from public.table_adjacencies a
using public.table_adjacencies b
where a.ctid < b.ctid
  and a.table_a = b.table_a
  and a.table_b = b.table_b;

-- Ensure PK exists.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.table_adjacencies'::regclass
      and contype = 'p'
  ) then
    alter table public.table_adjacencies
      add constraint table_adjacencies_pkey primary key (table_a, table_b);
  end if;
exception
  when duplicate_object then
    null;
end $$;

-- Ensure no self edges.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.table_adjacencies'::regclass
      and conname = 'table_adjacencies_no_self_edge'
  ) then
    alter table public.table_adjacencies
      add constraint table_adjacencies_no_self_edge check (table_a <> table_b);
  end if;
exception
  when duplicate_object then
    null;
end $$;

-- Ensure FK constraints exist (names may vary across envs; detect by column).
do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid
     and a.attnum = any (c.conkey)
    where c.conrelid = 'public.table_adjacencies'::regclass
      and c.contype = 'f'
      and a.attname = 'table_a'
  ) then
    alter table public.table_adjacencies
      add constraint table_adjacencies_table_a_fkey
      foreign key (table_a)
      references public.table_inventory(id)
      on delete cascade;
  end if;
exception
  when duplicate_object then
    null;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid
     and a.attnum = any (c.conkey)
    where c.conrelid = 'public.table_adjacencies'::regclass
      and c.contype = 'f'
      and a.attname = 'table_b'
  ) then
    alter table public.table_adjacencies
      add constraint table_adjacencies_table_b_fkey
      foreign key (table_b)
      references public.table_inventory(id)
      on delete cascade;
  end if;
exception
  when duplicate_object then
    null;
end $$;

create index if not exists idx_table_adjacencies_table_b on public.table_adjacencies (table_b);

-- Lock down: RLS enabled; no anon/authenticated policies.
alter table public.table_adjacencies enable row level security;

-- -----------------------------------------------------------------------------
-- 2) Core rebuild function
-- -----------------------------------------------------------------------------

create or replace function public.rebuild_zone_adjacencies(p_zone_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  -- no vars
begin
  if p_zone_id is null then
    return;
  end if;

  -- Serialize rebuilds per zone (transaction-scoped).
  perform pg_advisory_xact_lock(hashtext('zone_adjacency'), hashtext(p_zone_id::text));

  -- Remove any edges involving tables currently in this zone (clears drift and stale edges).
  delete from public.table_adjacencies ta
  where ta.table_a in (select id from public.table_inventory where zone_id = p_zone_id)
     or ta.table_b in (select id from public.table_inventory where zone_id = p_zone_id);

  -- Rebuild complete directed graph among eligible tables in-zone.
  with eligible as (
    select ti.id
    from public.table_inventory ti
    join public.zones z on z.id = ti.zone_id
    where ti.zone_id = p_zone_id
      and z.active is distinct from false
      and ti.active is distinct from false
      and coalesce(ti.capacity, 0) > 0
      and lower(coalesce(ti.status, 'available')) not in ('out_of_service', 'maintenance')
      and lower(coalesce(ti.mobility, 'movable')) in ('movable', 'adjustable')
  )
  insert into public.table_adjacencies (table_a, table_b)
  select a.id, b.id
  from eligible a
  join eligible b on b.id <> a.id
  on conflict do nothing;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3) Triggers
-- -----------------------------------------------------------------------------

create or replace function public.trg_table_inventory_rebuild_zone_adjacencies()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  zid uuid;
begin
  -- DELETEs are handled by FK ON DELETE CASCADE; remaining edges among other tables stay valid.
  if tg_op = 'DELETE' then
    return null;
  end if;

  if tg_op = 'UPDATE' then
    -- If a table moved zones or became unzoned, remove all its edges so old-zone leftovers cannot persist.
    delete from public.table_adjacencies ta
    using (
      select n.id
      from new_rows n
      join old_rows o on o.id = n.id
      where o.zone_id is distinct from n.zone_id
    ) moved
    where ta.table_a = moved.id or ta.table_b = moved.id;
  end if;

  -- Rebuild zones impacted by relevant changes.
  for zid in
    with
      norm as (
        select
          n.id,
          n.zone_id as zone_id_new,
          o.zone_id as zone_id_old,
          -- eligibility ignores zone.active here; zone trigger handles zone activation toggles.
          (
            n.zone_id is not null
            and n.active is distinct from false
            and coalesce(n.capacity, 0) > 0
            and lower(coalesce(n.status, 'available')) not in ('out_of_service', 'maintenance')
            and lower(coalesce(n.mobility, 'movable')) in ('movable', 'adjustable')
          ) as eligible_new,
          (
            o.zone_id is not null
            and o.active is distinct from false
            and coalesce(o.capacity, 0) > 0
            and lower(coalesce(o.status, 'available')) not in ('out_of_service', 'maintenance')
            and lower(coalesce(o.mobility, 'movable')) in ('movable', 'adjustable')
          ) as eligible_old,
          lower(coalesce(o.status, 'available')) as status_old,
          lower(coalesce(n.status, 'available')) as status_new
        from new_rows n
        left join old_rows o on o.id = n.id
      ),
      affected as (
        -- inserts: rebuild zone only if new row is eligible
        select zone_id_new as zone_id
        from norm
        where tg_op = 'INSERT' and eligible_new

        union

        -- updates: zone change => rebuild both old and new
        select zone_id_old as zone_id
        from norm
        where tg_op = 'UPDATE' and zone_id_old is distinct from zone_id_new

        union

        select zone_id_new as zone_id
        from norm
        where tg_op = 'UPDATE' and zone_id_old is distinct from zone_id_new

        union

        -- updates: eligibility changed in-place
        select zone_id_new as zone_id
        from norm
        where tg_op = 'UPDATE'
          and zone_id_old is not distinct from zone_id_new
          and eligible_old is distinct from eligible_new

        union

        -- updates: status crossing into/out of out_of_service/maintenance (structural)
        select zone_id_new as zone_id
        from norm
        where tg_op = 'UPDATE'
          and zone_id_new is not null
          and (
            (status_old in ('out_of_service', 'maintenance')) is distinct from (status_new in ('out_of_service', 'maintenance'))
          )
      )
    select distinct zone_id
    from affected
    where zone_id is not null
  loop
    perform public.rebuild_zone_adjacencies(zid);
  end loop;

  -- If any updated rows became unzoned, ensure their edges are gone.
  if tg_op = 'UPDATE' then
    delete from public.table_adjacencies ta
    using (
      select n.id
      from new_rows n
      join old_rows o on o.id = n.id
      where o.zone_id is not null and n.zone_id is null
    ) unzoned
    where ta.table_a = unzoned.id or ta.table_b = unzoned.id;
  end if;

  return null;
end;
$$;

-- Drop/recreate trigger for idempotency.
do $$
begin
  if exists (
    select 1
    from pg_trigger
    where tgname = 'table_inventory_rebuild_zone_adjacencies'
  ) then
    drop trigger table_inventory_rebuild_zone_adjacencies on public.table_inventory;
  end if;
end $$;

create trigger table_inventory_rebuild_zone_adjacencies
after insert or update or delete on public.table_inventory
referencing new table as new_rows old table as old_rows
for each statement
execute function public.trg_table_inventory_rebuild_zone_adjacencies();

create or replace function public.trg_zones_rebuild_zone_adjacencies()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.active is distinct from new.active then
    perform public.rebuild_zone_adjacencies(new.id);
  end if;
  return null;
end;
$$;

-- Drop/recreate for idempotency.
do $$
begin
  if exists (
    select 1
    from pg_trigger
    where tgname = 'zones_rebuild_zone_adjacencies'
  ) then
    drop trigger zones_rebuild_zone_adjacencies on public.zones;
  end if;
end $$;

create trigger zones_rebuild_zone_adjacencies
after update of active on public.zones
for each row
execute function public.trg_zones_rebuild_zone_adjacencies();

-- -----------------------------------------------------------------------------
-- 4) One-time backfill
-- -----------------------------------------------------------------------------

select public.rebuild_zone_adjacencies(id) from public.zones;

commit;
