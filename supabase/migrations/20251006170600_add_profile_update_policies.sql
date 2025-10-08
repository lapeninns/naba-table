-- Adds RLS and policies for profile update idempotency table

alter table public.profile_update_requests enable row level security;

-- Drop policies if they exist (idempotent)
drop policy if exists profile_update_requests_select on public.profile_update_requests;
drop policy if exists profile_update_requests_insert on public.profile_update_requests;
drop policy if exists profile_update_requests_update on public.profile_update_requests;
drop policy if exists profile_update_requests_delete on public.profile_update_requests;

-- Create policies - users can only manage their own idempotency records
create policy profile_update_requests_select
  on public.profile_update_requests
  for select
  using (auth.uid() = profile_id);

create policy profile_update_requests_insert
  on public.profile_update_requests
  for insert
  with check (auth.uid() = profile_id);

create policy profile_update_requests_update
  on public.profile_update_requests
  for update
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

create policy profile_update_requests_delete
  on public.profile_update_requests
  for delete
  using (auth.uid() = profile_id);
