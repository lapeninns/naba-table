-- Global operational metadata only: no restaurant, guest, token, or provider payload.
-- The application hashes request paths before forming the failure class.
begin;

create table public.operational_incidents (
  incident_key text primary key check (length(incident_key) between 1 and 602),
  version bigint not null check (version between 1 and 9007199254740991),
  incident jsonb not null check (jsonb_typeof(incident) = 'object' and octet_length(incident::text) <= 32768),
  updated_at timestamptz not null default now(),
  constraint operational_incident_key_matches check (
    incident ?& array['service', 'environment', 'failureClass', 'status']
    and incident_key = (incident->>'service') || '|' || (incident->>'environment') || '|' || (incident->>'failureClass')
    and incident->>'status' in ('open', 'acknowledged', 'escalated', 'resolved')
    and (incident->>'failureClass') ~ '^(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD):sha256:[a-f0-9]{64}$'
    and incident - array[
      'id', 'service', 'environment', 'failureClass', 'severity', 'status',
      'openedAt', 'lastFailureAt', 'lastObservedAt', 'occurrenceCount', 'updates',
      'summarizedFailures', 'owner', 'acknowledgedAt', 'acknowledgedBy',
      'escalatedAt', 'resolvedAt', 'consecutiveHealthy'
    ] = '{}'::jsonb
  )
);

alter table public.operational_incidents enable row level security;
revoke all on table public.operational_incidents from public, anon, authenticated, service_role;
comment on table public.operational_incidents is
  'Global error-insight lifecycle snapshots. No tenant or guest payload. Access through service-role-only CAS RPCs.';

create function public.read_operational_incident(p_key text)
returns jsonb
language sql stable security definer
set search_path = pg_catalog
as $$
  select jsonb_build_object('version', version, 'incident', incident)
  from public.operational_incidents where incident_key = p_key;
$$;

create function public.compare_and_swap_operational_incident(
  p_key text, p_expected_version bigint, p_incident jsonb
) returns boolean
language plpgsql security definer
set search_path = pg_catalog
as $$
begin
  if p_expected_version is null or p_expected_version < 0 or p_expected_version >= 9007199254740991 then
    raise exception 'Invalid incident version';
  end if;
  if p_expected_version = 0 then
    insert into public.operational_incidents (incident_key, version, incident)
    values (p_key, 1, p_incident)
    on conflict (incident_key) do nothing;
  else
    update public.operational_incidents
    set incident = p_incident, version = version + 1, updated_at = now()
    where incident_key = p_key and version = p_expected_version;
  end if;
  return found;
end;
$$;

-- Keep resolved snapshots and their monotonically increasing version to prevent ABA races.
-- No RPC deletes rows or resets versions; a new incident replaces a resolved snapshot by CAS.
revoke all on function public.read_operational_incident(text) from public, anon, authenticated;
revoke all on function public.compare_and_swap_operational_incident(text, bigint, jsonb) from public, anon, authenticated;
grant execute on function public.read_operational_incident(text) to service_role;
grant execute on function public.compare_and_swap_operational_incident(text, bigint, jsonb) to service_role;

commit;
