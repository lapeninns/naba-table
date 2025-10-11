-- Adds has_access flag to profiles to support QA session bootstrap and Ops access controls
alter table public.profiles
  add column if not exists has_access boolean not null default true;

comment on column public.profiles.has_access is 'Indicates whether the profile retains active access to Ops surfaces.';

create index if not exists idx_profiles_has_access on public.profiles(has_access);
