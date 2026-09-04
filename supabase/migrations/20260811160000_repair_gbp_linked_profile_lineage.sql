begin;

create or replace function public.ensure_gbp_linked_profile_lineage_v1()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.provider = 'google_business_profile'
     and new.connection_status = 'linked'
     and nullif(btrim(new.external_profile_id), '') is null then
    new.external_profile_id := new.id::text;
  end if;

  return new;
end;
$$;

drop trigger if exists ensure_gbp_linked_profile_lineage_v1
  on public.restaurant_external_profiles;
create trigger ensure_gbp_linked_profile_lineage_v1
before insert or update of connection_status, external_profile_id
on public.restaurant_external_profiles
for each row
execute function public.ensure_gbp_linked_profile_lineage_v1();

update public.restaurant_external_profiles
set external_profile_id = id::text,
    updated_at = timezone('utc', now())
where provider = 'google_business_profile'
  and connection_status = 'linked'
  and nullif(btrim(external_profile_id), '') is null;

alter table public.restaurant_external_profiles
  drop constraint if exists restaurant_external_profiles_linked_profile_lineage_v1_check,
  add constraint restaurant_external_profiles_linked_profile_lineage_v1_check
  check (
    provider <> 'google_business_profile'
    or connection_status <> 'linked'
    or nullif(btrim(external_profile_id), '') is not null
  ) not valid;

alter table public.restaurant_external_profiles
  validate constraint restaurant_external_profiles_linked_profile_lineage_v1_check;

revoke all on function public.ensure_gbp_linked_profile_lineage_v1() from public, anon, authenticated;

commit;
