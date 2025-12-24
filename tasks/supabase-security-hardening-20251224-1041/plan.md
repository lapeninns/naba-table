---
task: supabase-security-hardening
timestamp_utc: 2025-12-24T10:41:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Supabase Database Security Hardening

## Objective

We will harden the Supabase database by fixing function search path vulnerabilities, isolating extensions, enabling password leak protection, and upgrading Postgres to address security warnings from the database linter.

## Success Criteria

- [ ] All 34 functions have explicit `search_path` set
- [ ] Extensions moved from `public` to `extensions` schema
- [ ] Leaked password protection enabled
- [ ] Postgres upgraded to latest security-patched version
- [ ] Application functions verified working after changes

## Architecture & Components

### SQL Migrations

1. `01_fix_function_search_paths.sql` - Add `SET search_path = ''` to all 34 functions
2. `02_move_extensions.sql` - Move extensions to `extensions` schema

### Dashboard Actions

3. Enable leaked password protection (Auth settings)
4. Upgrade Postgres version (Project settings)

## Functions to Update (34 total)

| Function Name                                | Schema |
| -------------------------------------------- | ------ |
| `allocations_overlap`                        | public |
| `allowed_capacities_set_updated_at`          | public |
| `apply_booking_state_transition`             | public |
| `are_tables_connected`                       | public |
| `assign_tables_atomic`                       | public |
| `booking_status_summary`                     | public |
| `current_restaurant_id`                      | public |
| `generate_booking_reference`                 | public |
| `get_or_create_booking_slot`                 | public |
| `increment_booking_slot_version`             | public |
| `is_holds_strict_conflicts_enabled`          | public |
| `is_table_available_v2`                      | public |
| `log_table_assignment_change`                | public |
| `on_allocations_refresh`                     | public |
| `on_booking_status_refresh`                  | public |
| `process_late_arrivals`                      | public |
| `prune_allocations_history`                  | public |
| `refresh_table_status`                       | public |
| `require_restaurant_context`                 | public |
| `set_booking_instants`                       | public |
| `set_booking_reference`                      | public |
| `set_hold_conflict_enforcement`              | public |
| `set_timestamp_updated_at`                   | public |
| `set_updated_at`                             | public |
| `sync_table_hold_windows`                    | public |
| `unassign_table_from_booking`                | public |
| `unassign_tables_atomic`                     | public |
| `update_table_hold_windows`                  | public |
| `update_updated_at`                          | public |
| `update_updated_at_column`                   | public |
| `user_restaurants`                           | public |
| `validate_booking_capacity_after_assignment` | public |
| `validate_booking_has_assignments`           | public |
| `validate_table_adjacency`                   | public |

## Extensions to Move (3 total)

| Extension    | Current Schema | Target Schema |
| ------------ | -------------- | ------------- |
| `btree_gist` | public         | extensions    |
| `citext`     | public         | extensions    |
| `pgcrypto`   | public         | extensions    |

## Testing Strategy

### Pre-Migration

- Back up database (PITR enabled on Supabase)
- Test migrations in staging environment first

### Post-Migration

- Verify all functions still exist and return correct results
- Verify extensions are accessible
- Run application smoke tests
- Check booking creation, table assignment, search functionality

## Rollout

### Phase 1: SQL Migrations (Staging → Production)

1. Run in staging environment
2. Verify application functionality
3. Run in production during low-traffic window

### Phase 2: Dashboard Actions

1. Enable leaked password protection
2. Schedule Postgres upgrade for maintenance window

## DB Change Plan

- **Target envs**: Staging → Production
- **Backup reference**: Supabase automatic PITR
- **Dry-run evidence**: Test in staging first
- **Rollback plan**: Functions can be recreated without `SET search_path`; extensions can be moved back

---

## Execution Steps

### Step 1: Run Function Search Path Migration

Execute `01_fix_function_search_paths.sql` in Supabase SQL Editor

### Step 2: Run Extension Migration

Execute `02_move_extensions.sql` in Supabase SQL Editor

### Step 3: Enable Leaked Password Protection

1. Go to Supabase Dashboard → Authentication → Settings
2. Find "Password Security" section
3. Enable "HaveIBeenPwned" password checking

### Step 4: Upgrade Postgres

1. Go to Supabase Dashboard → Project Settings → Infrastructure
2. Click "Upgrade" on the Postgres version
3. Schedule for maintenance window
