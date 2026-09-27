begin;

drop index public.restaurant_gbp_food_menu_snapshots_hash_idx;
create unique index restaurant_gbp_food_menu_snapshots_hash_idx
  on public.restaurant_gbp_food_menu_snapshots (restaurant_id, snapshot_kind, snapshot_hash)
  where snapshot_hash is not null and snapshot_kind = 'nabatable_projection';

create function public.persist_gbp_food_menu_projection_v1(
  p_restaurant_id uuid, p_external_profile_row_id uuid, p_source text,
  p_food_menus_name text, p_raw_food_menus jsonb, p_snapshot_hash text,
  p_created_by_user_id uuid
) returns public.restaurant_gbp_food_menu_snapshots
language plpgsql security definer set search_path = public as $$
declare
  v_row public.restaurant_gbp_food_menu_snapshots%rowtype;
begin
  if p_source is null or p_source not in ('manual','scheduled','preflight','publish')
    or p_raw_food_menus is null or jsonb_typeof(p_raw_food_menus) <> 'object'
    or p_snapshot_hash is null or p_snapshot_hash !~ '^[a-f0-9]{64}$'
    or length(p_food_menus_name) > 1000 then
    raise exception using errcode = '22023', message = 'invalid local FoodMenus projection';
  end if;
  perform 1 from public.restaurants where id = p_restaurant_id for share;
  if not found then raise no_data_found; end if;
  if p_external_profile_row_id is not null then
    perform 1 from public.restaurant_external_profiles
      where id = p_external_profile_row_id and restaurant_id = p_restaurant_id
        and provider = 'google_business_profile' for share;
    if not found then
      raise exception using errcode = '42501', message = 'local FoodMenus profile tenant mismatch';
    end if;
  end if;
  if p_created_by_user_id is not null and not exists (
    select 1 from public.restaurant_memberships
    where restaurant_id = p_restaurant_id and user_id = p_created_by_user_id
  ) then
    raise exception using errcode = '42501', message = 'local FoodMenus actor tenant mismatch';
  end if;
  insert into public.restaurant_gbp_food_menu_snapshots (
    restaurant_id, external_profile_id, provider, snapshot_kind, source, status,
    food_menus_name, raw_food_menus, canonical_food_menus, projection_metadata,
    snapshot_hash, created_by_user_id
  ) values (
    p_restaurant_id, p_external_profile_row_id, 'google_business_profile',
    'nabatable_projection', p_source, 'succeeded', p_food_menus_name,
    p_raw_food_menus, null, '{}'::jsonb, p_snapshot_hash, p_created_by_user_id
  ) on conflict (restaurant_id, snapshot_kind, snapshot_hash)
    where snapshot_hash is not null and snapshot_kind = 'nabatable_projection'
    do nothing returning * into v_row;
  if not found then
    select * into strict v_row from public.restaurant_gbp_food_menu_snapshots
      where restaurant_id = p_restaurant_id and snapshot_kind = 'nabatable_projection'
        and snapshot_hash = p_snapshot_hash;
  end if;
  return v_row;
end;
$$;

revoke all on function public.persist_gbp_food_menu_projection_v1(uuid,uuid,text,text,jsonb,text,uuid)
  from public, anon, authenticated;
grant execute on function public.persist_gbp_food_menu_projection_v1(uuid,uuid,text,text,jsonb,text,uuid)
  to service_role;

commit;
