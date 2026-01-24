---
task: fix-ops-access
timestamp_utc: 2026-01-24T20:12:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Environment

- Supabase project: `loxrwkeuxesctnrdpksy` (nabatable-pre-staging)

## Checks

- [x] Service role key ref/role validated (`ref=loxrwkeuxesctnrdpksy`, `role=service_role`)
- [x] Schema grants verified (USAGE on `public` now true for anon/authenticated/service_role)
- [x] Secure cookies disabled for localhost (auth/CSRF/signout)
- [ ] Memberships API returns data (manual check required via browser session)

## Artifacts

- Query outputs recorded below.

## Query Evidence

- Service role JWT decoded locally (ref + role).
- Grant check: `select has_schema_privilege('service_role','public','USAGE') ...`
- Grants applied:
  - `grant usage on schema public to anon, authenticated, service_role;`
  - `grant all on all tables/sequences/functions in schema public ...`
  - `alter default privileges in schema public grant all ...`

## Manual Follow-up

- Load `/api/ops/team/memberships` (authenticated) and confirm non-empty memberships.
