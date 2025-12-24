---
task: supabase-security-hardening
timestamp_utc: 2025-12-24T10:41:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
source: Supabase Database Linter
---

# Research: Supabase Database Security Hardening

## Requirements

### Functional

- Fix 34 PostgreSQL functions with mutable search_path (security vulnerability)
- Move 3 extensions from `public` schema to dedicated `extensions` schema
- Enable leaked password protection for Auth
- Upgrade Postgres to latest security-patched version

### Non-functional (Security Focus)

- **Search Path Hijacking Prevention**: Without explicit `search_path`, attackers could create malicious objects in the `public` schema that override expected behavior
- **Schema Isolation**: Extensions in `public` schema increase attack surface
- **Password Security**: Prevent users from using known compromised passwords
- **Database Security**: Apply latest Postgres security patches

## Existing Patterns & Reuse

- N/A - These are database-level security configurations

## External Resources

- [Supabase: Function Search Path Mutable](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable)
- [Supabase: Extension in Public](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public)
- [Supabase: Password Security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
- [Supabase: Database Upgrades](https://supabase.com/docs/guides/platform/upgrading)

## Constraints & Risks

### Extension Migration Risks

- Moving extensions can break dependencies if not done carefully
- `btree_gist`, `citext`, `pgcrypto` may have dependent functions/indexes
- Requires careful testing after migration

### Function Search Path Risks

- Low risk - adding `SET search_path = ''` is additive, not destructive
- Some functions may need specific schemas in their path

### Dashboard Actions

- Leaked password protection: Configuration only, no risk
- Postgres upgrade: Requires maintenance window; test in staging first

## Open Questions (owner, due)

- Q: Are there any functions that intentionally rely on dynamic search_path?
  A: Unlikely in this application context

## Recommended Direction

1. **Phase 1**: Fix function search paths via SQL migration (immediate)
2. **Phase 2**: Move extensions to dedicated schema (can be done with Phase 1)
3. **Phase 3**: Enable leaked password protection (Dashboard action)
4. **Phase 4**: Schedule Postgres upgrade (requires planning)
